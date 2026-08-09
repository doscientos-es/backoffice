"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { InvoiceEmail } from "@/components/email";
import { defineAction } from "@/lib/actions/define-action";
import { requireRole } from "@/lib/auth";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import { computeLineTotals } from "@/lib/finance";
import { backupInvoiceToDrive } from "@/lib/google/backup";
import { pushMetaConversion } from "@/lib/integrations/meta-capi";
import {
  findClientInfo,
  findInvoiceForEdit,
  findInvoiceForEmail,
  findInvoiceForRectification,
  findInvoiceSeries,
  findNextInvoiceNumberForSeries,
  findProjectForHourlyBilling,
  findProposalForInvoice,
  findProposalItems,
  findUnlinkedWorkLogsForMonth,
  insertInvoiceWithItems,
  insertRectificationWithItems,
  linkWorkLogsToInvoice,
  patchInvoiceClientSnapshot,
  patchInvoiceHeader,
  patchInvoiceStatus,
  replaceInvoiceItems,
  restoreDeletedInvoice,
  softDeleteInvoice,
} from "@/lib/invoices/queries";
import type { InvoiceHeaderPatch } from "@/lib/invoices/types";
import { scopedLogger } from "@/lib/logger";
import { buildPortalAccessPatch } from "@/lib/portal/access";
import { uuidIdInput } from "@/lib/schemas/common";
import {
  CreateInvoiceFromProposalInput,
  CreateMonthlyHourlyInvoiceInput,
  CreateRectificationInput,
  MarkUncollectibleInput,
  SendInvoiceEmailInput,
  SendInvoiceInput,
  UpdateInvoiceInput as UpdateInvoiceInputSchema,
  type UpdateInvoiceInputType,
  UpdateInvoiceStatusInput,
} from "@/lib/schemas/invoice";
import { UpdatePortalAccessInput } from "@/lib/schemas/portal";
import { consumeUserVerification } from "@/lib/security/user-verification";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import {
  assertDurableVerifactuPackage,
  deliverInvoiceVerifactu,
  deliverVerifactuOutbox,
  syncInvoiceQrFromLedger,
} from "@/lib/verifactu/outbox";

const log = scopedLogger("invoices.actions");

export type UpdateInvoiceInput = UpdateInvoiceInputType;

function outboxIdFromRpc(data: unknown): string {
  const row = Array.isArray(data) ? data[0] : data;
  const outboxId =
    row && typeof row === "object" ? (row as { outbox_id?: unknown }).outbox_id : null;
  if (typeof outboxId !== "string") throw new Error("No se pudo crear la cola de envío fiscal");
  return outboxId;
}

async function enqueueFiscalRecord(invoiceId: string, cancellation = false): Promise<string> {
  const supabase = await createServerClient();
  const functionName = cancellation
    ? "cancel_invoice_with_verifactu_outbox"
    : "issue_invoice_with_verifactu_outbox";
  const { data, error } = await supabase.rpc(functionName, { p_invoice_id: invoiceId });
  if (error) throw new Error(error.message);
  return outboxIdFromRpc(data);
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Updates the status of an invoice. If moving to 'paid', we set 'paid_at'.
 * If moving to 'issued' from 'draft', we set 'issued_at'.
 * On first issuance the client snapshot (name, nif, address) is refreshed from
 * the current client record so any edits made while in draft are captured.
 * Best-effort Drive backup fires on first issuance.
 */
export const updateInvoiceStatus = defineAction({
  name: "invoices.updateStatus",
  schema: UpdateInvoiceStatusInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input, { user }) => {
    const { id, status } = input;
    await consumeUserVerification(
      user.id,
      userVerificationScope("invoice.status.update", `invoice:${id}:status:${status}`),
    );
    if (status === "issued" || status === "cancelled") {
      await assertDurableVerifactuPackage();
      const outboxId = await enqueueFiscalRecord(id, status === "cancelled");
      if (status === "issued") await syncInvoiceQrFromLedger(id);
      const delivery = await deliverVerifactuOutbox(outboxId, `action:${crypto.randomUUID()}`);
      if (delivery.status !== "accepted") {
        log.warn(
          { invoiceId: id, status: delivery.status },
          "verifactu_immediate_delivery_deferred",
        );
      }
      if (status === "issued") void backupInvoiceToDrive(id, user.email);
      return;
    }

    const now = new Date().toISOString();

    await patchInvoiceStatus(id, {
      status,
      updated_at: now,
      paid_at: status === "paid" ? now : null,
      ...(status === "paid" && input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
    });

    // Fire-and-forget: notify Meta CAPI when an invoice is paid — the
    // highest-value signal for the ad algorithm to optimise towards.
    if (status === "paid") {
      after(async () => {
        try {
          const inv = await findInvoiceForEmail(id);
          if (inv?.client?.email) {
            await pushMetaConversion({
              eventName: "Purchase",
              eventId: `invoice-${id}-paid`,
              email: inv.client.email,
              value: inv.total,
              currency: "EUR",
              actionSource: "system_generated",
              custom_data: {
                event_source: "crm",
                lead_event_source: "doscientos-backoffice",
              },
            });
          }
        } catch (e) {
          log.warn({ err: e, invoiceId: id }, "meta_capi_purchase_failed");
        }
      });
    }
  },
});

// ─── Draft: reload client snapshot ───────────────────────────────────────────

/**
 * While the invoice is still a draft, pull the latest fiscal data from the
 * linked client record and overwrite the invoice snapshot fields. Once the
 * invoice is issued the immutability trigger will block any further edits.
 */
export const refreshInvoiceClientSnapshot = defineAction({
  name: "invoices.refreshClientSnapshot",
  schema: uuidIdInput,
  revalidate: (_p, input) => [`/invoices/${input.id}`],
  handler: async (input) => {
    const supabase = await createServerClient();

    // Fetch the invoice's linked client_id
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("client_id, status")
      .eq("id", input.id)
      .maybeSingle();
    if (invErr || !inv) throw new Error(invErr?.message ?? "Factura no encontrada");
    if (inv.status !== "draft") throw new Error("Solo se pueden actualizar facturas en borrador");
    if (!inv.client_id) throw new Error("La factura no tiene un cliente asociado");

    const client = await findClientInfo(inv.client_id as string);
    if (!client) throw new Error("Cliente no encontrado");

    await patchInvoiceClientSnapshot(input.id, {
      client_name: client.name,
      client_nif: client.nif,
      client_address_street: client.billing_address_street,
      client_address_zip: client.billing_address_zip,
      client_address_city: client.billing_address_city,
      client_address_province: client.billing_address_province,
      client_address_country: client.billing_address_country,
    });
  },
});

// ─── Soft-delete / restore ────────────────────────────────────────────────────

export const deleteInvoice = defineAction({
  name: "invoices.delete",
  schema: uuidIdInput,
  roles: ["owner", "admin"],
  revalidate: () => ["/invoices"],
  handler: async (input) => {
    // Facturas aceptadas por la AEAT no pueden eliminarse (RD 1007/2023 art. 8).
    // Debe emitirse una factura rectificativa en su lugar.
    const supabase = await createServerClient();
    const { data: inv } = await supabase
      .from("invoices")
      .select("verifactu_status")
      .eq("id", input.id)
      .maybeSingle();
    if (inv?.verifactu_status === "accepted") {
      throw new Error(
        "Las facturas aceptadas por la AEAT no pueden eliminarse. Emite una factura rectificativa.",
      );
    }
    await softDeleteInvoice(input.id);
  },
});

/**
 * Reverses a soft-delete. Backs the "Deshacer" toast shown after `deleteInvoice`.
 */
export const restoreInvoice = defineAction({
  name: "invoices.restore",
  schema: uuidIdInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices"],
  handler: async (input) => {
    await restoreDeletedInvoice(input.id);
  },
});

// ─── Verifactu (AEAT) ─────────────────────────────────────────────────────────

/**
 * Re-delivers the pre-generated RegistroAlta. It never recreates a hash or
 * overwrites fiscal evidence; a non-due/accepted job simply returns no CSV.
 */
export const sendToAeat = defineAction<typeof SendInvoiceInput, { csv: string | null }>({
  name: "invoices.sendToAeat",
  schema: SendInvoiceInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input, { user }) => {
    const { id } = input;
    await consumeUserVerification(
      user.id,
      userVerificationScope("invoice.send_aeat", `invoice:${id}`),
    );
    await assertDurableVerifactuPackage();
    const delivery = await deliverInvoiceVerifactu(id, `manual:${crypto.randomUUID()}`);
    return { csv: delivery.csv };
  },
});

// ─── Invoice creation ─────────────────────────────────────────────────────────

/**
 * Creates a draft invoice from an accepted proposal, cloning the one-time line
 * items, totals, and client/project references.
 */
export const createInvoiceFromProposal = defineAction<
  typeof CreateInvoiceFromProposalInput,
  { id: string }
>({
  name: "invoices.createFromProposal",
  schema: CreateInvoiceFromProposalInput,
  revalidate: (_p, input) => ["/invoices", `/proposals/${input.proposalId}`],
  handler: async (input, { user }) => {
    const { proposalId } = input;
    const proposal = await findProposalForInvoice(proposalId);
    if (!proposal) throw new Error("Propuesta no encontrada");
    if (proposal.status !== "accepted")
      throw new Error("Solo se puede facturar una propuesta aceptada");

    const allItems = await findProposalItems(proposalId);
    if (allItems.length === 0) throw new Error("La propuesta no tiene líneas para facturar");

    // Only bill one-time lines; recurring lines are handled by periodic invoicing.
    const items = allItems.filter((it) => (it.billing_cycle ?? "none") === "none");
    if (items.length === 0) {
      throw new Error(
        "Esta propuesta solo contiene líneas recurrentes; crea la factura manualmente",
      );
    }

    const [client, series] = await Promise.all([
      findClientInfo(proposal.client_id),
      findInvoiceSeries(),
    ]);
    const nextNumber = await findNextInvoiceNumberForSeries(series);
    const { subtotal, taxAmount, total } = computeLineTotals(items);

    const { id } = await insertInvoiceWithItems(
      {
        client_id: proposal.client_id,
        project_id: proposal.project_id,
        proposal_id: proposal.id,
        series,
        number: nextNumber,
        status: "draft",
        currency: "EUR",
        subtotal,
        tax_amount: taxAmount,
        total,
        client_nif: client?.nif ?? null,
        client_name: client?.name ?? null,
        client_address_street: client?.billing_address_street ?? null,
        client_address_zip: client?.billing_address_zip ?? null,
        client_address_city: client?.billing_address_city ?? null,
        client_address_province: client?.billing_address_province ?? null,
        client_address_country: client?.billing_address_country ?? null,
        notes: proposal.notes,
        created_by: user.id,
      },
      items.map((it, idx) => ({
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
      })),
    );

    return { id };
  },
});

/**
 * Generates a draft invoice for an hourly project from work logs in a given
 * calendar month. Fixed-price projects are rejected.
 */
export const createHourlyInvoice = defineAction<
  typeof CreateMonthlyHourlyInvoiceInput,
  { id: string }
>({
  name: "invoices.createHourly",
  schema: CreateMonthlyHourlyInvoiceInput,
  revalidate: (_p, input) => ["/invoices", `/projects/${input.projectId}`],
  handler: async (input, { user }) => {
    const { projectId, month } = input;

    const project = await findProjectForHourlyBilling(projectId);
    if (!project) throw new Error("Proyecto no encontrado");
    if (project.billing_type !== "hourly") throw new Error("El proyecto no factura por horas");
    if (!(project.hourly_rate > 0)) throw new Error("El proyecto no tiene un precio/hora válido");

    const year = Number(month.slice(0, 4));
    const mon = Number(month.slice(5, 7));
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 10);

    const logs = await findUnlinkedWorkLogsForMonth(projectId, monthStart, monthEnd);
    const hours = logs.reduce((sum, l) => sum + l.hours, 0);
    if (!(hours > 0)) throw new Error("No hay horas registradas en ese mes");

    const [client, series] = await Promise.all([
      findClientInfo(project.client_id),
      findInvoiceSeries(),
    ]);
    const nextNumber = await findNextInvoiceNumberForSeries(series);

    const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
      new Date(`${monthStart}T00:00:00`),
    );
    const { subtotal, taxAmount, total } = computeLineTotals([
      { quantity: hours, unit_price: project.hourly_rate, vat_rate: project.hourly_vat_rate },
    ]);

    const { id } = await insertInvoiceWithItems(
      {
        client_id: project.client_id,
        project_id: project.id,
        series,
        number: nextNumber,
        status: "draft",
        currency: "EUR",
        subtotal,
        tax_amount: taxAmount,
        total,
        client_nif: client?.nif ?? null,
        client_name: client?.name ?? null,
        client_address_street: client?.billing_address_street ?? null,
        client_address_zip: client?.billing_address_zip ?? null,
        client_address_city: client?.billing_address_city ?? null,
        client_address_province: client?.billing_address_province ?? null,
        client_address_country: client?.billing_address_country ?? null,
        created_by: user.id,
      },
      [
        {
          position: 0,
          description: `Horas trabajadas: ${monthLabel}`,
          quantity: hours,
          unit_price: project.hourly_rate,
          vat_rate: project.hourly_vat_rate,
        },
      ],
    );

    // Link logs to invoice so they can't be double-billed (best-effort).
    try {
      await linkWorkLogsToInvoice(
        logs.map((l) => l.id),
        id,
      );
    } catch (err) {
      log.error({ err, invoiceId: id }, "link_work_logs_failed");
    }

    return { id };
  },
});

// ─── Edit ─────────────────────────────────────────────────────────────────────

/**
 * Patches a draft invoice in place. When `items` is present, line items are
 * replaced and totals recomputed server-side.
 * Locked once the invoice is `issued` or beyond (Verifactu compliance).
 */
export const updateInvoice = defineAction({
  name: "invoices.update",
  schema: UpdateInvoiceInputSchema,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`],
  handler: async (input) => {
    const current = await findInvoiceForEdit(input.id);
    if (!current) throw new Error("Factura no encontrada");
    if (current.status !== "draft") throw new Error("No se puede editar una factura ya emitida");

    const headerPatch: InvoiceHeaderPatch = { updated_at: new Date().toISOString() };
    if (input.issue_date) headerPatch.issue_date = input.issue_date;
    if (input.due_date !== undefined) headerPatch.due_date = input.due_date ?? null;
    if (input.notes !== undefined) headerPatch.notes = input.notes;
    if (input.payment_terms !== undefined) headerPatch.payment_terms = input.payment_terms ?? null;

    if (input.items) {
      const { subtotal, taxAmount, total } = computeLineTotals(input.items);
      headerPatch.subtotal = subtotal;
      headerPatch.tax_amount = taxAmount;
      headerPatch.total = total;
    }

    await patchInvoiceHeader(input.id, headerPatch);

    if (input.items) {
      await replaceInvoiceItems(
        input.id,
        input.items.map((it, idx) => ({
          position: idx,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
        })),
      );
    }
  },
});

// ─── Portal access ────────────────────────────────────────────────────────────

/**
 * Updates the public-link visibility and optional password gate of an invoice.
 * Allowed even after issuance — only fiscal columns are immutable.
 *
 * Implemented as a plain async function (not `defineAction`) because it is
 * consumed by the resource-agnostic `PortalAccessControls` component which
 * expects `(input: unknown) => Promise<{ ok: true } | { ok: false; error }>`.
 */
export async function updateInvoicePortalAccess(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole(["owner", "admin"]);
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const parsed = UpdatePortalAccessInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
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

// ─── Rectification ───────────────────────────────────────────────────────────

const RECTIFICATION_SERIES = "R";

/**
 * Creates a rectification invoice (factura rectificativa) from an issued invoice.
 * Conforms to RD 1619/2012 art.15 and Verifactu RD 1007/2023.
 *
 * Flow:
 *  1. Validates the original is issued/paid (not draft/cancelled/already-rectified).
 *  2. Clones the line items onto a new draft with series R and the given type (R1/R4).
 *  3. Marks the original as `rectified` so no further rectifications can be issued.
 *
 * The user can edit the draft (amounts, description) before issuing it to AEAT.
 */
export const createRectification = defineAction<typeof CreateRectificationInput, { id: string }>({
  name: "invoices.createRectification",
  schema: CreateRectificationInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.originalInvoiceId}`, "/invoices"],
  handler: async (input, { user }) => {
    const { originalInvoiceId, rectificationType, reason } = input;

    const original = await findInvoiceForRectification(originalInvoiceId);
    if (!original) throw new Error("Factura original no encontrada");

    const RECTIFIABLE_STATUSES = ["issued", "paid", "overdue"] as const;
    if (!(RECTIFIABLE_STATUSES as readonly string[]).includes(original.status)) {
      throw new Error(
        `Solo pueden rectificarse facturas emitidas o pagadas. El estado actual es: ${original.status}`,
      );
    }
    if (original.is_rectification) {
      throw new Error(
        "No se puede rectificar una factura que ya es rectificativa. Rectifica la factura original.",
      );
    }

    // Fetch original items to clone
    const supabase = await createServerClient();
    const { data: originalItems, error: itemsErr } = await supabase
      .from("invoice_items")
      .select("position, description, quantity, unit_price, vat_rate")
      .eq("invoice_id", originalInvoiceId)
      .order("position");
    if (itemsErr) throw new Error(itemsErr.message);

    const nextNumber = await findNextInvoiceNumberForSeries(RECTIFICATION_SERIES);

    const { id } = await insertRectificationWithItems(
      {
        client_id: original.client_id,
        project_id: original.project_id,
        series: RECTIFICATION_SERIES,
        number: nextNumber,
        invoice_type: rectificationType,
        status: "draft",
        currency: "EUR",
        subtotal: original.subtotal,
        tax_amount: original.tax_amount,
        total: original.total,
        client_nif: original.client_nif,
        client_name: original.client_name,
        client_address_street: original.client_address_street,
        client_address_zip: original.client_address_zip,
        client_address_city: original.client_address_city,
        client_address_province: original.client_address_province,
        client_address_country: original.client_address_country,
        notes: original.notes,
        payment_terms: original.payment_terms,
        created_by: user.id,
        // Rectification metadata
        is_rectification: true,
        rectified_invoice_id: originalInvoiceId,
        rectification_reason: reason,
        rectification_type: rectificationType,
      },
      (originalItems ?? []).map((it, idx) => ({
        position: idx,
        description: (it.description as string | null) ?? null,
        quantity: Number(it.quantity ?? 1),
        unit_price: Number(it.unit_price ?? 0),
        vat_rate: Number(it.vat_rate ?? 21),
      })),
    );

    // Mark original invoice as rectified so it can't be rectified again.
    await patchInvoiceStatus(originalInvoiceId, {
      status: "rectified",
      updated_at: new Date().toISOString(),
      paid_at: null,
    });

    log.info(
      { originalInvoiceId, rectificationId: id, rectificationType },
      "rectification_created",
    );

    return { id };
  },
});

// ─── Send email ───────────────────────────────────────────────────────────────

/**
 * Emails the public portal link to the client via Resend.
 * Requires the invoice to be issued and client-visible.
 */
export const sendInvoiceEmail = defineAction<
  typeof SendInvoiceEmailInput,
  { portalUrl: string; mocked: boolean }
>({
  name: "invoices.sendEmail",
  schema: SendInvoiceEmailInput,
  revalidate: (_p, input) => [`/invoices/${input.id}`],
  handler: async (input, { user }) => {
    const { id, to: overrideTo, message } = input;

    const invoice = await findInvoiceForEmail(id);
    if (!invoice) throw new Error("Factura no encontrada");
    if (invoice.status === "draft")
      throw new Error("Emite la factura antes de enviarla al cliente");
    if (!invoice.is_client_visible) throw new Error("La factura no es visible para el cliente");

    const recipient = overrideTo ?? invoice.client?.email ?? null;
    if (!recipient) throw new Error("El cliente no tiene email registrado");
    if (!invoice.portal_token) throw new Error("La factura no tiene token de portal");

    const invoiceNumber = invoice.full_number ?? "—";
    const portalUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/p/invoice/${invoice.portal_token}`;
    const html = await renderEmail(
      InvoiceEmail({
        clientName: invoice.client?.name ?? "Hola",
        invoiceNumber,
        total: formatEUR(invoice.total ?? 0),
        dueDate: invoice.due_date ? formatDate(invoice.due_date) : "—",
        portalUrl,
        appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
        message,
      }),
    );

    const result = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? "facturacion",
      to: recipient,
      replyTo: user.contactEmail ?? user.email,
      subject: `Factura ${invoiceNumber}`,
      html,
      tags: { invoice_id: id, kind: "invoice_link" },
    });

    return { portalUrl, mocked: result.mocked };
  },
});

// ─── Incobrable (art. 80.Tres LIVA) ──────────────────────────────────────────

/**
 * Marks an invoice as uncollectible (crédito incobrable) per art. 80.Tres LIVA.
 * Requires the invoice to be overdue (unpaid after due date).
 * Sets is_uncollectible = true and uncollectible_at = now().
 *
 * After marking, the company must issue a rectificativa R4 to reclaim VAT.
 * Use createRectification({ rectificationType: 'R4', ... }) for that step.
 */
export const markAsUncollectible = defineAction<typeof MarkUncollectibleInput, { id: string }>({
  name: "invoices.markAsUncollectible",
  schema: MarkUncollectibleInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices"],
  handler: async (input) => {
    const { id } = input;
    const supabase = await createServerClient();

    const { data: inv, error } = await supabase
      .from("invoices")
      .select("status, due_date, is_uncollectible")
      .eq("id", id)
      .maybeSingle();

    if (error || !inv) throw new Error("Factura no encontrada");
    if (inv.is_uncollectible) throw new Error("La factura ya está marcada como incobrable");
    if (!["issued", "overdue"].includes(inv.status as string)) {
      throw new Error(
        "Solo pueden marcarse como incobrables facturas emitidas o vencidas no cobradas",
      );
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("invoices")
      .update({ is_uncollectible: true, uncollectible_at: now, updated_at: now })
      .eq("id", id);

    if (updateErr) throw new Error(updateErr.message);

    log.info({ invoiceId: id }, "invoice_marked_uncollectible");
    return { id };
  },
});
