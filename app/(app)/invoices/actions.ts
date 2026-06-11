"use server";

import { requireRole, requireUser } from "@/lib/auth";
import { promoteLeadFromClient } from "@/lib/crm/conversion";
import { serverEnv } from "@/lib/env";
import { computeLineTotals } from "@/lib/finance";
import { scopedLogger } from "@/lib/logger";
import { buildPortalAccessPatch } from "@/lib/portal/access";
import {
  CreateInvoiceFromProposalInput,
  SendInvoiceInput,
  UpdateInvoiceInput as UpdateInvoiceInputSchema,
  type UpdateInvoiceInputType,
  UpdateInvoiceStatusInput,
} from "@/lib/schemas/invoice";
import { UpdatePortalAccessInput } from "@/lib/schemas/portal";
import { createServerClient } from "@/lib/supabase/server";
import { submitToVerifactu } from "@/lib/verifactu/client";
import { buildQrUrl } from "@/lib/verifactu/qr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const log = scopedLogger("invoices.actions");

export type UpdateInvoiceInput = UpdateInvoiceInputType;

type ActionResult = { ok: true; csv: string | null } | { ok: false; error: string };
type FromProposalResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Updates the status of an invoice. If moving to 'paid', we set 'paid_at'.
 * If moving to 'issued' from 'draft', we set 'issued_at'.
 */
export async function updateInvoiceStatus(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const parsed = UpdateInvoiceStatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };
  const { id, status } = parsed.data;

  const supabase = await createServerClient();

  // Read current fiscal timestamps so we don't clobber the original issue date
  // when transitioning between non-draft states (e.g. reverting paid → issued).
  const { data: current } = await supabase
    .from("invoices")
    .select("issued_at")
    .eq("id", id)
    .maybeSingle();

  const now = new Date().toISOString();
  const updates: any = { status, updated_at: now };

  // `paid_at` reflects collection: set it when paid, clear it otherwise so a
  // paid invoice can be marked back as "no cobrada" (used during testing).
  updates.paid_at = status === "paid" ? now : null;

  // Stamp `issued_at` only the first time the invoice leaves draft.
  if (status === "issued" && !current?.issued_at) {
    updates.issued_at = now;
  }

  const { error } = await supabase.from("invoices").update(updates).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/inicio");
  return { ok: true };
}

export async function deleteInvoice(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const id = formData.get("id")?.toString() ?? "";
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/invoices");
  return { ok: true };
}

/**
 * Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
 * shown after `deleteInvoice`. Mirrors its FormData signature and role guard.
 */
export async function restoreInvoice(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const id = formData.get("id")?.toString() ?? "";
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true };
}

/**
 * Sends an invoice to Verifactu (AEAT). Computes the SHA-256 hash chain entry
 * using the previous invoice in `chain_sequence` order, builds the IDFACT and
 * QR URL, submits via `submitToVerifactu`, and persists the result.
 *
 * Only `owner` and `admin` can trigger this. Idempotent on the row: if the
 * invoice is already `accepted`, the call short-circuits.
 */
export async function sendToAeat(formData: FormData): Promise<ActionResult> {
  await requireRole(["owner", "admin"]);
  const env = serverEnv();

  const parsed = SendInvoiceInput.safeParse({ id: formData.get("id")?.toString() ?? "" });
  if (!parsed.success) return { ok: false, error: "ID inválido" };
  const { id } = parsed.data;

  if (!env.VERIFACTU_NIF_EMISOR) {
    return { ok: false, error: "Falta VERIFACTU_NIF_EMISOR en el entorno" };
  }

  const supabase = await createServerClient();

  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select(
      "id, client_id, status, verifactu_status, full_number, invoice_type, issue_date, tax_amount, total, previous_hash, chain_sequence",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError || !invoice) {
    return { ok: false, error: "Factura no encontrada" };
  }
  if (invoice.status === "draft") {
    return { ok: false, error: "Emite la factura antes de enviarla a la AEAT" };
  }
  if (invoice.verifactu_status === "accepted") {
    return { ok: true, csv: null };
  }
  if (invoice.verifactu_status === "excluded") {
    return { ok: false, error: "Esta factura está excluida de Verifactu" };
  }

  // Resolve previous hash from the latest accepted invoice in the chain.
  const { data: prev } = await supabase
    .from("invoices")
    .select("current_hash, chain_sequence")
    .eq("verifactu_status", "accepted")
    .not("current_hash", "is", null)
    .order("chain_sequence", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const previousHash = (prev?.current_hash as string | null) ?? null;
  const nextSequence = ((prev?.chain_sequence as number | null) ?? 0) + 1;
  const generatedAt = new Date();
  const issueDate = new Date(invoice.issue_date as string);

  const result = await submitToVerifactu({
    nif: env.VERIFACTU_NIF_EMISOR,
    invoiceNumber: invoice.full_number as string,
    invoiceType: invoice.invoice_type as string,
    issueDate,
    taxAmount: Number(invoice.tax_amount ?? 0),
    total: Number(invoice.total ?? 0),
    previousHash,
    generatedAt,
  });

  const qrUrl = buildQrUrl(
    {
      nif: env.VERIFACTU_NIF_EMISOR,
      invoiceNumber: invoice.full_number as string,
      issueDate,
      total: Number(invoice.total ?? 0),
    },
    env.NEXT_PUBLIC_APP_URL,
  );

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      idfact: result.idfact,
      previous_hash: previousHash,
      current_hash: result.hash,
      chain_sequence: result.status === "accepted" ? nextSequence : null,
      hash_generated_at: generatedAt.toISOString(),
      verifactu_status: result.status === "accepted" ? "accepted" : "rejected",
      verifactu_submitted_at: generatedAt.toISOString(),
      verifactu_csv: result.csv,
      verifactu_response: result.response,
      qr_url: qrUrl,
      issued_at: invoice.verifactu_status === "pending" ? generatedAt.toISOString() : undefined,
    })
    .eq("id", id);

  if (updateError) {
    log.error({ err: updateError, invoiceId: id }, "verifactu_persist_failed");
    return { ok: false, error: updateError.message };
  }

  log.info({ invoiceId: id, csv: result.csv, status: result.status }, "verifactu_submit_done");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/inicio");

  if (result.status !== "accepted") {
    return { ok: false, error: result.errorMessage ?? "AEAT rechazó la factura" };
  }

  // Safety net: once the invoice is fiscally accepted, the originating lead
  // is definitively won. Best-effort; never blocks the response.
  if (invoice.client_id) {
    await promoteLeadFromClient(supabase, invoice.client_id as string);
  }

  return { ok: true, csv: result.csv };
}

/**
 * Create a draft invoice cloning the line items, totals and client/project
 * references from an accepted proposal. The new invoice keeps `proposal_id`
 * pointing to the source so the relationship survives for reporting and
 * partial billing scenarios (multiple invoices per proposal are allowed —
 * e.g. monthly billing of an hourly engagement).
 */
export async function createInvoiceFromProposal(input: unknown): Promise<FromProposalResult> {
  const user = await requireUser();
  const parsed = CreateInvoiceFromProposalInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido" };
  const { proposalId } = parsed.data;

  const supabase = await createServerClient();

  const { data: proposal, error: readError } = await supabase
    .from("proposals")
    .select("id, client_id, project_id, status, title, notes")
    .eq("id", proposalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  if (proposal.status !== "accepted") {
    return { ok: false, error: "Solo se puede facturar una propuesta aceptada" };
  }

  const { data: allItems, error: itemsReadError } = await supabase
    .from("proposal_items")
    .select("position, description, quantity, unit_price, vat_rate, billing_cycle")
    .eq("proposal_id", proposalId)
    .order("position");

  if (itemsReadError) return { ok: false, error: itemsReadError.message };
  if (!allItems || allItems.length === 0) {
    return { ok: false, error: "La propuesta no tiene líneas para facturar" };
  }

  // First invoice from a proposal only bills the one-time (non-recurring) lines.
  // Recurring lines (mantenimiento, etc.) require dedicated periodic invoicing
  // and would otherwise inflate the first invoice with future obligations.
  const items = allItems.filter((it) => ((it.billing_cycle as string | null) ?? "none") === "none");
  if (items.length === 0) {
    return {
      ok: false,
      error: "Esta propuesta solo contiene líneas recurrentes; crea la factura manualmente",
    };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name, nif, billing_address")
    .eq("id", proposal.client_id as string)
    .maybeSingle();

  const { data: settings } = await supabase
    .from("settings")
    .select("invoice_series")
    .eq("id", 1)
    .maybeSingle();
  const series = ((settings?.invoice_series as string | null) ?? "A").trim() || "A";

  const { data: lastInSeries } = await supabase
    .from("invoices")
    .select("number")
    .eq("series", series)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = ((lastInSeries?.number as number | null) ?? 0) + 1;

  const { subtotal, taxAmount, total } = computeLineTotals(
    items.map((it) => ({
      quantity: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      vat_rate: Number(it.vat_rate ?? 0),
    })),
  );

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      client_id: proposal.client_id,
      project_id: proposal.project_id ?? null,
      proposal_id: proposal.id,
      series,
      number: nextNumber,
      status: "draft",
      currency: "EUR",
      subtotal,
      tax_amount: taxAmount,
      total,
      client_nif: (client?.nif as string | null) ?? null,
      client_name: (client?.name as string | null) ?? null,
      client_address: (client?.billing_address as string | null) ?? null,
      notes: (proposal.notes as string | null) ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !invoice) {
    log.error({ err: insertError, proposalId }, "create_invoice_from_proposal_failed");
    return { ok: false, error: insertError?.message ?? "No se pudo crear la factura" };
  }

  const { error: itemsInsertError } = await supabase.from("invoice_items").insert(
    items.map((it, idx) => ({
      invoice_id: invoice.id,
      position: idx,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
    })),
  );

  if (itemsInsertError) {
    log.error(
      { err: itemsInsertError, invoiceId: invoice.id, proposalId },
      "create_invoice_from_proposal_items_failed",
    );
    return { ok: false, error: itemsInsertError.message };
  }

  revalidatePath("/invoices");
  revalidatePath(`/proposals/${proposalId}`);
  return { ok: true, id: invoice.id as string };
}

/**
 * Patches an invoice in place. Accepts a partial payload; when `items` is
 * present the line items are replaced atomically (delete + insert) and
 * totals recomputed server-side.
 *
 * Locked once the invoice is `issued` or beyond (Verifactu compliance).
 */
export async function updateInvoice(
  input: UpdateInvoiceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const parsed = UpdateInvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const data = parsed.data;

  const supabase = await createServerClient();

  // Verify status is draft.
  const { data: current } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", data.id)
    .single();

  if (!current) return { ok: false, error: "Factura no encontrada" };
  if (current.status !== "draft") {
    return { ok: false, error: "No se puede editar una factura ya emitida" };
  }

  const updates: any = { updated_at: new Date().toISOString() };
  if (data.issue_date) updates.issue_date = data.issue_date;
  if (data.due_date) updates.due_date = data.due_date;
  if (data.notes !== undefined) updates.notes = data.notes;

  if (data.items) {
    const totals = computeLineTotals(data.items);
    updates.subtotal = totals.subtotal;
    updates.tax_amount = totals.taxAmount;
    updates.total = totals.total;
  }

  const { error: updateError } = await supabase.from("invoices").update(updates).eq("id", data.id);
  if (updateError) return { ok: false, error: updateError.message };

  if (data.items) {
    // Replace items.
    const { error: deleteError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", data.id);
    if (deleteError) return { ok: false, error: deleteError.message };

    const { error: itemsError } = await supabase.from("invoice_items").insert(
      data.items.map((it, idx) => ({
        invoice_id: data.id,
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
      })),
    );
    if (itemsError) return { ok: false, error: itemsError.message };
  }

  revalidatePath(`/invoices/${data.id}`);
  return { ok: true };
}

// ---------------- PORTAL ACCESS (visibility + password) ----------------

/**
 * Updates the public-link access controls of an invoice: the
 * `is_client_visible` toggle and/or the optional password gate. Only touches
 * portal metadata, so it is allowed even after the invoice is issued (the
 * Verifactu immutability trigger guards only the fiscal columns).
 */
export async function updateInvoicePortalAccess(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const parsed = UpdatePortalAccessInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const patch = buildPortalAccessPatch(parsed.data);
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createServerClient();
  const { error } = await supabase.from("invoices").update(patch).eq("id", parsed.data.id);
  if (error) {
    log.error({ err: error, id: parsed.data.id }, "update_invoice_portal_access_failed");
    return { ok: false, error: error.message };
  }

  revalidatePath(`/invoices/${parsed.data.id}`);
  return { ok: true };
}
