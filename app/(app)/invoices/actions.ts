"use server";
import { InvoiceEmail } from "@/components/email";
import { defineAction } from "@/lib/actions/define-action";
import { requireRole } from "@/lib/auth";
import { promoteLeadFromClient } from "@/lib/crm/conversion";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import { buildVatBreakdown, computeLineTotals } from "@/lib/finance";
import { backupInvoiceToDrive } from "@/lib/google/backup";
import {
  findClientInfo,
  findCompanySettings,
  findInvoiceForEdit,
  findInvoiceForEmail,
  findInvoiceForVerifactu,
  findInvoiceItemsForVat,
  findInvoiceSeries,
  findInvoiceTimestamps,
  findLastVerifactuChainEntry,
  findNextInvoiceNumberForSeries,
  findProjectForHourlyBilling,
  findProposalForInvoice,
  findProposalItems,
  findUnlinkedWorkLogsForMonth,
  insertInvoiceWithItems,
  linkWorkLogsToInvoice,
  patchInvoiceAfterVerifactu,
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
  SendInvoiceEmailInput,
  SendInvoiceInput,
  UpdateInvoiceInput as UpdateInvoiceInputSchema,
  type UpdateInvoiceInputType,
  UpdateInvoiceStatusInput,
} from "@/lib/schemas/invoice";
import { UpdatePortalAccessInput } from "@/lib/schemas/portal";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { verifactuConfigFromEnv } from "@/lib/verifactu/config";
import { createVerifactuClient } from "@doscientos/verifactu";
import { revalidatePath } from "next/cache";

const log = scopedLogger("invoices.actions");

export type UpdateInvoiceInput = UpdateInvoiceInputType;

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Updates the status of an invoice. If moving to 'paid', we set 'paid_at'.
 * If moving to 'issued' from 'draft', we set 'issued_at'.
 * Best-effort Drive backup fires on first issuance.
 */
export const updateInvoiceStatus = defineAction({
  name: "invoices.updateStatus",
  schema: UpdateInvoiceStatusInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input, { user }) => {
    const { id, status } = input;
    const timestamps = await findInvoiceTimestamps(id);
    const now = new Date().toISOString();

    await patchInvoiceStatus(id, {
      status,
      updated_at: now,
      paid_at: status === "paid" ? now : null,
      ...(status === "issued" && !timestamps?.issued_at ? { issued_at: now } : {}),
    });

    // Best-effort Drive backup on first issuance — fires as the acting user.
    if (status === "issued" && !timestamps?.issued_at) {
      void backupInvoiceToDrive(id, user.email);
    }
  },
});

// ─── Soft-delete / restore ────────────────────────────────────────────────────

export const deleteInvoice = defineAction({
  name: "invoices.delete",
  schema: uuidIdInput,
  roles: ["owner", "admin"],
  revalidate: () => ["/invoices"],
  handler: async (input) => {
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
 * Submits an invoice to Verifactu (AEAT). Computes the SHA-256 hash chain entry,
 * builds the IDFACT and QR URL, persists the result.
 * Idempotent: short-circuits when the invoice is already `accepted`.
 */
export const sendToAeat = defineAction<typeof SendInvoiceInput, { csv: string | null }>({
  name: "invoices.sendToAeat",
  schema: SendInvoiceInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input) => {
    const { id } = input;
    const verifactu = createVerifactuClient(verifactuConfigFromEnv(), log);

    const [companySetting, invoice] = await Promise.all([
      findCompanySettings(),
      findInvoiceForVerifactu(id),
    ]);

    if (!companySetting?.company_nif) throw new Error("Falta el NIF de la empresa en Ajustes");
    if (!invoice) throw new Error("Factura no encontrada");
    if (invoice.status === "draft") throw new Error("Emite la factura antes de enviarla a la AEAT");
    if (invoice.verifactu_status === "accepted") return { csv: null };
    if (invoice.verifactu_status === "excluded")
      throw new Error("Esta factura está excluida de Verifactu");

    const [prev, vatItems] = await Promise.all([
      findLastVerifactuChainEntry(),
      findInvoiceItemsForVat(id),
    ]);

    const vatLines = buildVatBreakdown(
      vatItems.map((it) => ({ vat_rate: it.vat_rate, subtotal: it.subtotal })),
    );
    const descriptionOperacion =
      vatItems
        .map((it) => it.description)
        .filter(Boolean)
        .join(", ")
        .slice(0, 250) || "Prestación de servicios profesionales";

    const previousHash = prev?.current_hash ?? null;
    const previousInvoiceNumber = prev?.full_number ?? null;
    const previousIssueDate = prev?.issue_date ? new Date(prev.issue_date) : null;
    const nextSequence = (prev?.chain_sequence ?? 0) + 1;
    const generatedAt = new Date();
    const issueDate = new Date(invoice.issue_date);

    const result = await verifactu.registerInvoice({
      nif: companySetting.company_nif,
      invoiceNumber: invoice.full_number,
      invoiceType: invoice.invoice_type,
      issueDate,
      taxAmount: invoice.tax_amount,
      total: invoice.total,
      previousHash,
      generatedAt,
      emisorName: companySetting.company_name,
      clientNif: invoice.client_nif,
      clientName: invoice.client_name,
      descriptionOperacion,
      vatLines,
      previousInvoiceNumber,
      previousIssueDate,
    });

    const qrUrl = verifactu.buildQrUrl({
      nif: companySetting.company_nif,
      invoiceNumber: invoice.full_number,
      issueDate,
      total: invoice.total,
    });

    await patchInvoiceAfterVerifactu(id, {
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
      ...(invoice.verifactu_status === "pending" ? { issued_at: generatedAt.toISOString() } : {}),
    });

    log.info({ invoiceId: id, csv: result.csv, status: result.status }, "verifactu_submit_done");

    if (result.status !== "accepted") {
      throw new Error(result.errorMessage ?? "AEAT rechazó la factura");
    }

    // Once fiscally accepted, the originating lead is definitively won.
    if (invoice.client_id) {
      const supabase = await createServerClient();
      await promoteLeadFromClient(supabase, invoice.client_id);
    }

    return { csv: result.csv };
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
        client_address: client?.billing_address ?? null,
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
        client_address: client?.billing_address ?? null,
        created_by: user.id,
      },
      [
        {
          position: 0,
          description: `Horas trabajadas — ${monthLabel}`,
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
