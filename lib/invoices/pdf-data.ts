import "server-only";

import { formatAddress } from "@/lib/address";
import { type VatBreakdownRow, buildVatBreakdown } from "@/lib/finance";
import { verifactuConfigFromEnv } from "@/lib/verifactu/config";
import { buildQrDataUrl, buildQrUrl } from "@doscientos/verifactu";

/**
 * Normalised, render-ready snapshot of an invoice for the PDF document.
 *
 * Built once on the server and shared by both the internal and portal PDF
 * routes so the generated document is identical regardless of the caller.
 */
export type InvoicePdfItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  subtotal: number;
};

/** Render-ready work-log entry shown on the PDF activity page. */
export type InvoicePdfWorkLog = {
  workDate: string | null;
  memberName: string | null;
  startTime: string | null;
  endTime: string | null;
  hours: number;
  note: string | null;
};

/** Raw work-log row both callers can shape from their own queries. */
export type InvoicePdfWorkLogInput = {
  work_date: string | null;
  member_name: string | null;
  start_time: string | null;
  end_time: string | null;
  hours: number | null;
  note: string | null;
};

export type InvoicePdfData = {
  fullNumber: string;
  invoiceType: string | null;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  idfact: string | null;
  verifactuCsv: string | null;
  clientName: string | null;
  clientNif: string | null;
  clientAddress: string | null;
  company: {
    name: string | null;
    nif: string | null;
    address: string | null;
    iban: string | null;
  } | null;
  items: InvoicePdfItem[];
  subtotal: number;
  total: number;
  vatBreakdown: VatBreakdownRow[];
  qrDataUrl: string | null;
  /** Tracked hours linked to this invoice, rendered on a second page. */
  workLogs: InvoicePdfWorkLog[];
};

/** Raw pieces both callers can shape from their own queries. */
export type BuildInvoicePdfInput = {
  invoice: {
    full_number: string | null;
    invoice_type: string | null;
    status: string | null;
    issue_date: string | null;
    due_date: string | null;
    idfact: string | null;
    verifactu_csv: string | null;
    subtotal: number | null;
    total: number | null;
    client_nif: string | null;
    client_address_street?: string | null;
    client_address_zip?: string | null;
    client_address_city?: string | null;
    client_address_province?: string | null;
    client_address_country?: string | null;
  };
  clientName: string | null;
  items: ReadonlyArray<{
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    vat_rate: number | null;
    subtotal: number | null;
  }>;
  settings: {
    company_name: string | null;
    company_nif: string | null;
    company_address_street?: string | null;
    company_address_zip?: string | null;
    company_address_city?: string | null;
    company_address_province?: string | null;
    company_address_country?: string | null;
    iban: string | null;
  } | null;
  workLogs?: ReadonlyArray<InvoicePdfWorkLogInput>;
};

/**
 * Build the Verifactu QR data URL when the invoice carries the required fiscal
 * data. Mirrors the logic used by the HTML invoice views. Returns `null` when
 * the emisor NIF is missing or the invoice is incomplete.
 */
async function buildInvoiceQr(
  invoice: BuildInvoicePdfInput["invoice"],
  emisorNif: string | null,
): Promise<string | null> {
  if (
    !emisorNif ||
    invoice.status === "draft" ||
    !invoice.full_number ||
    !invoice.issue_date ||
    invoice.total == null
  ) {
    return null;
  }
  const qrUrl = buildQrUrl(
    {
      nif: emisorNif,
      invoiceNumber: invoice.full_number,
      issueDate: new Date(invoice.issue_date),
      total: invoice.total,
    },
    verifactuConfigFromEnv(),
  );
  return buildQrDataUrl(qrUrl);
}

/** Shape raw query rows into the render-ready {@link InvoicePdfData}. */
export async function buildInvoicePdfData(input: BuildInvoicePdfInput): Promise<InvoicePdfData> {
  const { invoice, items, settings } = input;

  const normalisedItems: InvoicePdfItem[] = items.map((item) => ({
    description: item.description ?? "",
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    vatRate: Number(item.vat_rate ?? 0),
    subtotal: Number(item.subtotal ?? 0),
  }));

  const normalisedWorkLogs: InvoicePdfWorkLog[] = (input.workLogs ?? []).map((log) => ({
    workDate: log.work_date,
    memberName: log.member_name,
    startTime: log.start_time,
    endTime: log.end_time,
    hours: Number(log.hours ?? 0),
    note: log.note,
  }));

  return {
    fullNumber: invoice.full_number ?? "",
    invoiceType: invoice.invoice_type,
    status: invoice.status ?? "draft",
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    idfact: invoice.idfact,
    verifactuCsv: invoice.verifactu_csv,
    clientName: input.clientName,
    clientNif: invoice.client_nif,
    clientAddress:
      formatAddress({
        street: invoice.client_address_street,
        zip: invoice.client_address_zip,
        city: invoice.client_address_city,
        province: invoice.client_address_province,
        country: invoice.client_address_country,
      }) || null,
    company: settings
      ? {
          name: settings.company_name,
          nif: settings.company_nif,
          address:
            formatAddress({
              street: settings.company_address_street,
              zip: settings.company_address_zip,
              city: settings.company_address_city,
              province: settings.company_address_province,
              country: settings.company_address_country,
            }) || null,
          iban: settings.iban,
        }
      : null,
    items: normalisedItems,
    subtotal: Number(invoice.subtotal ?? 0),
    total: Number(invoice.total ?? 0),
    vatBreakdown: buildVatBreakdown(
      normalisedItems.map((i) => ({ vat_rate: i.vatRate, subtotal: i.subtotal })),
    ),
    qrDataUrl: await buildInvoiceQr(invoice, process.env.VERIFACTU_NIF_EMISOR || null),
    workLogs: normalisedWorkLogs,
  };
}

/** Safe, descriptive download filename for an invoice PDF. */
export function invoicePdfFilename(fullNumber: string | null, fallbackId: string): string {
  const base = (fullNumber ?? fallbackId).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `factura-${base || fallbackId}.pdf`;
}
