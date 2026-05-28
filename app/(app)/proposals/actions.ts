"use server";

import { ProposalEmail } from "@/components/email";
import { requireUser } from "@/lib/auth";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import { computeLineTotals } from "@/lib/finance";
import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const log = scopedLogger("proposals");

const LineItem = z.object({
  description: z.string().min(1, "Descripción obligatoria").max(500),
  quantity: z.coerce.number().positive("Cantidad > 0"),
  unit_price: z.coerce.number().nonnegative("Precio ≥ 0"),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
});

const CreateInput = z.object({
  client_id: z.string().uuid("Cliente inválido"),
  project_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  title: z.string().min(1, "Título obligatorio").max(200),
  valid_until: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z.string().max(4000).optional(),
  items: z.array(LineItem).min(1, "Añade al menos una línea"),
});

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

export async function createProposal(formData: FormData): Promise<void> {
  const user = await requireUser();

  const itemsRaw = formData.get("items")?.toString() ?? "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Líneas no válidas");
  }

  const parsed = CreateInput.safeParse({
    client_id: formData.get("client_id")?.toString() ?? "",
    project_id: formData.get("project_id")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    valid_until: formData.get("valid_until")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    items,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");
  }
  const data = parsed.data;

  const { subtotal, taxAmount, total } = computeLineTotals(data.items);

  const supabase = await createServerClient();
  const number = await nextProposalNumber(supabase);

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      client_id: data.client_id,
      project_id: data.project_id ?? null,
      number,
      title: data.title,
      status: "draft",
      currency: "EUR",
      subtotal,
      tax_amount: taxAmount,
      total,
      valid_until: data.valid_until ?? null,
      notes: data.notes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !proposal) {
    log.error({ err: error }, "create_proposal_failed");
    throw new Error(error?.message ?? "No se pudo crear la propuesta");
  }

  const { error: itemsError } = await supabase.from("proposal_items").insert(
    data.items.map((it, idx) => ({
      proposal_id: proposal.id,
      position: idx,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
    })),
  );
  if (itemsError) {
    log.error({ err: itemsError, proposalId: proposal.id }, "create_proposal_items_failed");
    throw new Error(itemsError.message);
  }

  revalidatePath("/proposals");
  redirect(`/proposals/${proposal.id}`);
}

/**
 * JSON version of createProposal for use with autosave or client-side calls.
 * Returns the created proposal ID on success.
 */
export async function createProposalAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const data = parsed.data;

  const { subtotal, taxAmount, total } = computeLineTotals(data.items);

  const supabase = await createServerClient();
  const number = await nextProposalNumber(supabase);

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      client_id: data.client_id,
      project_id: data.project_id ?? null,
      number,
      title: data.title,
      status: "draft",
      currency: "EUR",
      subtotal,
      tax_amount: taxAmount,
      total,
      valid_until: data.valid_until ?? null,
      notes: data.notes ?? null,
      created_by: user.id,
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
    })),
  );
  if (itemsError) {
    log.error({ err: itemsError, proposalId: proposal.id }, "create_proposal_items_failed");
    return { ok: false, error: itemsError.message };
  }

  revalidatePath("/proposals");
  return { ok: true, id: proposal.id as string };
}

// ---------------- UPDATE (collaborative inline edits + autosave) ----------------

const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  valid_until: z
    .string()
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  notes: z
    .string()
    .max(4000)
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  intro: z
    .string()
    .max(20_000)
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  terms: z
    .string()
    .max(20_000)
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  items: z.array(LineItem).min(1).optional(),
});

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

  const parsed = UpdateInput.safeParse(input);
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
  if (rest.intro !== undefined) patch.intro = rest.intro;
  if (rest.terms !== undefined) patch.terms = rest.terms;

  if (items) {
    const totals = computeLineTotals(items);
    patch.subtotal = totals.subtotal;
    patch.tax_amount = totals.taxAmount;
    patch.total = totals.total;
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

// ---------------- SEND PREVIEW LINK (client portal) ----------------

const SendPreviewInput = z.object({
  id: z.string().uuid(),
  to: z.string().email().optional(),
  message: z.string().max(1000).optional(),
});

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

  const parsed = SendPreviewInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { id, to: overrideTo, message } = parsed.data;

  const supabase = await createServerClient();
  const { data: proposal, error: readError } = await supabase
    .from("proposals")
    .select(
      "id, number, title, total, status, portal_token, valid_until, sent_at, clients(name, email)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError || !proposal) return { ok: false, error: "Propuesta no encontrada" };

  const client = (proposal as unknown as { clients: { name: string; email: string | null } | null })
    .clients;
  const recipient = overrideTo ?? client?.email ?? null;
  if (!recipient) return { ok: false, error: "El cliente no tiene email registrado" };

  const portalToken = proposal.portal_token as string | null;
  if (!portalToken) return { ok: false, error: "La propuesta no tiene token de portal" };

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
  const html = await renderEmail(
    ProposalEmail({
      clientName: client?.name ?? "Hola",
      proposalTitle: proposal.title as string,
      proposalNumber: proposal.number as string,
      total: formatEUR(proposal.total as number),
      validUntil: proposal.valid_until ? formatDate(proposal.valid_until as string) : undefined,
      portalUrl,
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
      subject: `Propuesta ${proposal.number as string} · ${proposal.title as string}`,
      html,
      tags: { proposal_id: id, kind: "proposal_preview" },
    });
    mocked = result.mocked;
  } catch (err) {
    log.error({ err, proposalId: id }, "send_preview_link_failed");
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo enviar el email" };
  }

  const patch: Record<string, unknown> = {};
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
