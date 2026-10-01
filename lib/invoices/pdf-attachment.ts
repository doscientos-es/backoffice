import { findWorkLogsForInvoice, getInvoiceDetail } from "@/lib/invoices/queries";

/** Renders the invoice PDF so it can travel attached to an email. */
export async function buildInvoicePdfAttachment(
  invoiceId: string,
): Promise<{ filename: string; content: Buffer }> {
  // The renderer pulls the whole React-PDF document tree; load it only when the
  // attachment was actually requested so unrelated action bundles stay lean.
  const [{ renderInvoicePdf }, { buildInvoicePdfData, invoicePdfFilename }] = await Promise.all([
    import("@/lib/invoices/invoice-pdf-document"),
    import("@/lib/invoices/pdf-data"),
  ]);

  const detail = await getInvoiceDetail(invoiceId);
  if (!detail) throw new Error("No se pudo generar el PDF de la factura");
  const { invoice, items, settings } = detail;
  const workLogs = await findWorkLogsForInvoice(invoice.id);
  const data = await buildInvoicePdfData({
    invoice,
    clientName: invoice.client?.name ?? null,
    clientLogoUrl: invoice.client?.logo_url ?? null,
    items,
    settings,
    workLogs,
  });

  return {
    filename: invoicePdfFilename(invoice.full_number, invoice.id),
    content: await renderInvoicePdf(data),
  };
}
