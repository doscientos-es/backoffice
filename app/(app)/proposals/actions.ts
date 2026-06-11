"use server";

import { ProposalEmail } from "@/components/email";
import { requireUser } from "@/lib/auth";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import { computeProposalTotals } from "@/lib/finance";
import { scopedLogger } from "@/lib/logger";
import { buildPortalAccessPatch } from "@/lib/portal/access";
import { UpdatePortalAccessInput } from "@/lib/schemas/portal";
import {
  CreateProposalInput,
  DuplicateProposalInput,
  SendProposalPreviewInput,
  UpdateProposalInput,
} from "@/lib/schemas/proposal";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const log = scopedLogger("proposals");

/**
 * Allocates the next sequential proposal number for the current year. Called
 * only at the first transition to `sent` so drafts don't consume numbers in
 * the legal series.
 */
async function nextProposalNumber(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `P-${year}-`;
  const { data } = await supabase
    .from("proposals")
    .select("number")
    .like("number", `${prefix}%`)
    .order("number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.number as string | undefined;
  const lastSeq = last ? Number.parseInt(last.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

/**
 * Shared insert path used by both the FormData and JSON entry points. The
 * proposal lands as a draft without a number — numbers are assigned on the
 * first transition to `sent` via `sendPreviewLink`.
 */
async function insertDraftProposal(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  data: import("@/lib/schemas/proposal").CreateProposalInputType,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { oneTime } = computeProposalTotals(data.items);

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      client_id: data.client_id ?? null,
      lead_id: data.lead_id ?? null,
      number: null,
      title: data.title,
      status: "draft",
      currency: "EUR",
      subtotal: oneTime.subtotal,
      tax_amount: oneTime.taxAmount,
      total: oneTime.total,
      valid_until: data.valid_until ?? null,
      notes: data.notes ?? null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !proposal) {
    log.error({ err: error }, "create_proposal_failed");
    return { ok: false, error: error?.message ?? "No se pudo crear la propuesta" };
  }

  const { error: itemsError } = await supabase.from("proposal_items").insert(
    data.items.map((it, idx) => ({
      proposal_id: proposal.id,
      position: idx,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
      billing_cycle: it.billing_cycle,
    })),
  );
  if (itemsError) {
    log.error({ err: itemsError, proposalId: proposal.id }, "create_proposal_items_failed");
    return { ok: false, error: itemsError.message };
  }

  return { ok: true, id: proposal.id as string };
}

export async function createProposal(formData: FormData): Promise<void> {
  const user = await requireUser();

  const itemsRaw = formData.get("items")?.toString() ?? "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Líneas no válidas");
  }

  const parsed = CreateProposalInput.safeParse({
    client_id: formData.get("client_id")?.toString() ?? "",
    lead_id: formData.get("lead_id")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    valid_until: formData.get("valid_until")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    items,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");
  }

  const supabase = await createServerClient();
  const res = await insertDraftProposal(supabase, user.id, parsed.data);
  if (!res.ok) throw new Error(res.error);

  revalidatePath("/proposals");
  redirect(`/proposals/${res.id}`);
}

/**
 * JSON version of createProposal for use with autosave or client-side calls.
 * Returns the created proposal ID on success.
 */
export async function createProposalAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = CreateProposalInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }

  const supabase = await createServerClient();
  const res = await insertDraftProposal(supabase, user.id, parsed.data);
  if (!res.ok) return res;

  revalidatePath("/proposals");
  return { ok: true, id: res.id };
}

/**
 * Clones an existing proposal as a new draft. Resets status, portal token,
 * number, timestamps and signature data; copies title (prefixed "Copia de"),
 * target, narrative blocks, terms, notes and line items. Useful for
 * re-quoting after a rejection or when iterating with the same client.
 */
export async function duplicateProposal(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = DuplicateProposalInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Identificador no válido" };
  }

  const supabase = await createServerClient();
  const { data: source, error: readError } = await supabase
    .from("proposals")
    .select(
      "client_id, lead_id, title, valid_until, notes, context_markdown, problems, solutions, terms, subtotal, tax_amount, total, currency",
    )
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError || !source) return { ok: false, error: "Propuesta no encontrada" };

  const { data: items, error: itemsErr } = await supabase
    .from("proposal_items")
    .select("position, description, quantity, unit_price, vat_rate, billing_cycle")
    .eq("proposal_id", parsed.data.id)
    .order("position");
  if (itemsErr) return { ok: false, error: itemsErr.message };

  const { data: created, error: insertError } = await supabase
    .from("proposals")
    .insert({
      client_id: source.client_id,
      lead_id: source.lead_id,
      number: null,
      title: `Copia de ${source.title as string}`,
      status: "draft",
      currency: (source.currency as string) ?? "EUR",
      subtotal: source.subtotal,
      tax_amount: source.tax_amount,
      total: source.total,
      valid_until: null,
      notes: source.notes,
      context_markdown: source.context_markdown,
      problems: source.problems,
      solutions: source.solutions,
      terms: source.terms,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError || !created) {
    log.error({ err: insertError, sourceId: parsed.data.id }, "duplicate_proposal_failed");
    return { ok: false, error: insertError?.message ?? "No se pudo duplicar la propuesta" };
  }

  if ((items ?? []).length > 0) {
    const { error: copyErr } = await supabase.from("proposal_items").insert(
      (items ?? []).map((it, idx) => ({
        proposal_id: created.id,
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        billing_cycle: it.billing_cycle,
      })),
    );
    if (copyErr) {
      log.error({ err: copyErr, sourceId: parsed.data.id }, "duplicate_proposal_items_failed");
      return { ok: false, error: copyErr.message };
    }
  }

  revalidatePath("/proposals");
  return { ok: true, id: created.id as string };
}

// ---------------- UPDATE (collaborative inline edits + autosave) ----------------

type UpdateResult = { ok: true } | { ok: false; error: string };

/**
 * Patches a proposal in place. Used by the inline editor + autosave loop.
 * Accepts a partial payload; when `items` is present the line items are
 * replaced atomically (delete + insert) and totals recomputed server-side.
 *
 * Locked once the proposal is `accepted` or `rejected`.
 */
export async function updateProposal(input: unknown): Promise<UpdateResult> {
  await requireUser();

  const parsed = UpdateProposalInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { id, items, ...rest } = parsed.data;

  const supabase = await createServerClient();

  const { data: current, error: readError } = await supabase
    .from("proposals")
    .select("status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError || !current) return { ok: false, error: "Propuesta no encontrada" };
  if (current.status === "accepted" || current.status === "rejected") {
    return { ok: false, error: "La propuesta ya ha sido respondida y no se puede editar" };
  }

  const patch: Record<string, unknown> = {};
  if (rest.title !== undefined) patch.title = rest.title;
  if (rest.valid_until !== undefined) patch.valid_until = rest.valid_until;
  if (rest.notes !== undefined) patch.notes = rest.notes;
  if (rest.context_markdown !== undefined) patch.context_markdown = rest.context_markdown;
  if (rest.problems !== undefined) {
    patch.problems = rest.problems && rest.problems.length > 0 ? rest.problems : null;
  }
  if (rest.solutions !== undefined) {
    patch.solutions = rest.solutions && rest.solutions.length > 0 ? rest.solutions : null;
  }
  if (rest.terms !== undefined) patch.terms = rest.terms;

  if (items) {
    const { oneTime } = computeProposalTotals(items);
    patch.subtotal = oneTime.subtotal;
    patch.tax_amount = oneTime.taxAmount;
    patch.total = oneTime.total;
  }

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from("proposals").update(patch).eq("id", id);
    if (updateError) {
      log.error({ err: updateError, id }, "update_proposal_failed");
      return { ok: false, error: updateError.message };
    }
  }

  if (items) {
    const { error: deleteError } = await supabase
      .from("proposal_items")
      .delete()
      .eq("proposal_id", id);
    if (deleteError) {
      log.error({ err: deleteError, id }, "update_proposal_items_delete_failed");
      return { ok: false, error: deleteError.message };
    }
    const { error: insertError } = await supabase.from("proposal_items").insert(
      items.map((it, idx) => ({
        proposal_id: id,
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        billing_cycle: it.billing_cycle,
      })),
    );
    if (insertError) {
      log.error({ err: insertError, id }, "update_proposal_items_insert_failed");
      return { ok: false, error: insertError.message };
    }
  }

  revalidatePath(`/proposals/${id}`);
  return { ok: true };
}

// ---------------- DELETE (soft) ----------------

/**
 * Soft-deletes a proposal by stamping `deleted_at`. The associated invoice
 * FK (`invoices.proposal_id`) is `on delete set null` at the DB level, so
 * already-issued invoices keep their data even after deletion. Reversible
 * by clearing `deleted_at` directly in the database.
 */
export async function deleteProposal(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const id = formData.get("id")?.toString() ?? "";
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("proposals")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    log.error({ err: error, id }, "delete_proposal_failed");
    return { ok: false, error: error.message };
  }

  revalidatePath("/proposals");
  return { ok: true };
}

/**
 * Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
 * shown after `deleteProposal`. Mirrors `deleteProposal`'s FormData signature.
 */
export async function restoreProposal(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const id = formData.get("id")?.toString() ?? "";
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("proposals")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    log.error({ err: error, id }, "restore_proposal_failed");
    return { ok: false, error: error.message };
  }

  revalidatePath(`/proposals/${id}`);
  revalidatePath("/proposals");
  return { ok: true };
}

// ---------------- PORTAL ACCESS (visibility + password) ----------------

/**
 * Updates the public-link access controls of a proposal: the
 * `is_client_visible` toggle and/or the optional password gate. Each field is
 * independent — omit one to leave it untouched. `password: null` clears it.
 */
export async function updateProposalPortalAccess(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const parsed = UpdatePortalAccessInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const patch = buildPortalAccessPatch(parsed.data);
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createServerClient();
  const { error } = await supabase.from("proposals").update(patch).eq("id", parsed.data.id);
  if (error) {
    log.error({ err: error, id: parsed.data.id }, "update_proposal_portal_access_failed");
    return { ok: false, error: error.message };
  }

  revalidatePath(`/proposals/${parsed.data.id}`);
  return { ok: true };
}

// ---------------- SEND PREVIEW LINK (client portal) ----------------

type SendPreviewResult =
  | { ok: true; portalUrl: string; mocked: boolean }
  | { ok: false; error: string };

/**
 * Sends the public portal URL of a proposal to the client via Resend and
 * transitions the proposal from `draft` → `sent` (setting `sent_at`).
 * Idempotent for already-sent proposals.
 */
export async function sendPreviewLink(input: unknown): Promise<SendPreviewResult> {
  const user = await requireUser();

  const parsed = SendProposalPreviewInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { id, to: overrideTo, message } = parsed.data;

  const supabase = await createServerClient();
  const { data: proposal, error: readError } = await supabase
    .from("proposals")
    .select(
      "id, number, title, total, status, portal_token, valid_until, sent_at, clients(name, email), leads(name, email)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError || !proposal) return { ok: false, error: "Propuesta no encontrada" };

  // Recipient: prefer the explicit override, otherwise fall back to the
  // client email and finally to the lead email when the proposal targets a
  // lead that hasn't yet been upgraded to a client.
  const client = (proposal as unknown as { clients: { name: string; email: string | null } | null })
    .clients;
  const lead = (proposal as unknown as { leads: { name: string; email: string | null } | null })
    .leads;
  const recipient = overrideTo ?? client?.email ?? lead?.email ?? null;
  if (!recipient) return { ok: false, error: "El destinatario no tiene email registrado" };

  const portalToken = proposal.portal_token as string | null;
  if (!portalToken) return { ok: false, error: "La propuesta no tiene token de portal" };

  // Assign the legal proposal number on the first transition to `sent`. This
  // keeps drafts out of the official series so cancelled proposals don't
  // leave gaps in the numbering exposed to the customer.
  let proposalNumber = proposal.number as string | null;
  if (!proposalNumber) {
    proposalNumber = await nextProposalNumber(supabase);
  }

  // Fetch client-visible technical specs so the email can link to them.
  const { data: specs } = await supabase
    .from("proposal_specs")
    .select("title, portal_token")
    .eq("proposal_id", id)
    .eq("is_client_visible", true)
    .not("portal_token", "is", null);

  const specLinks = ((specs ?? []) as Array<{ title: string; portal_token: string }>)
    .filter((s) => s.portal_token)
    .map((s) => ({
      title: s.title,
      url: `${publicEnv.NEXT_PUBLIC_APP_URL}/p/spec/${s.portal_token}`,
    }));

  const portalUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/p/proposal/${portalToken}`;
  const deckUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/deck/${portalToken}`;
  const html = await renderEmail(
    ProposalEmail({
      clientName: client?.name ?? lead?.name ?? "Hola",
      proposalTitle: proposal.title as string,
      proposalNumber,
      total: formatEUR(proposal.total as number),
      validUntil: proposal.valid_until ? formatDate(proposal.valid_until as string) : undefined,
      portalUrl,
      deckUrl,
      appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
      message,
      specs: specLinks,
    }),
  );

  let mocked = false;
  try {
    const result = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? "propuestas",
      to: recipient,
      replyTo: user.contactEmail ?? user.email,
      subject: `Propuesta ${proposalNumber} · ${proposal.title as string}`,
      html,
      tags: { proposal_id: id, kind: "proposal_preview" },
    });
    mocked = result.mocked;
  } catch (err) {
    log.error({ err, proposalId: id }, "send_preview_link_failed");
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo enviar el email" };
  }

  const patch: Record<string, unknown> = {};
  if (!proposal.number) patch.number = proposalNumber;
  if (proposal.status === "draft") {
    patch.status = "sent";
    patch.sent_at = new Date().toISOString();
  } else if (!proposal.sent_at) {
    patch.sent_at = new Date().toISOString();
  }
  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from("proposals").update(patch).eq("id", id);
    if (updateError) {
      log.error({ err: updateError, id }, "send_preview_link_update_failed");
    }
  }

  revalidatePath(`/proposals/${id}`);
  return { ok: true, portalUrl, mocked };
}
