import { createServerClient } from "@/lib/supabase/server";

import { createXlsx, csvWithBom, type QuarterlyPeriod, type XlsxCell } from "./quarterly-invoices";

export const EXPORTABLE_INVOICE_STATUSES = ["issued", "paid", "overdue", "rectified"];
export const QUARTERLY_CSV_HEADERS = [
  "Tipo",
  "Número / referencia",
  "Fecha",
  "Contraparte",
  "NIF",
  "Categoría",
  "Base",
  "IVA",
  "Total",
  "Estado",
  "Estado Verifactu",
  "CSV Verifactu",
  "Adjuntos",
  "Enlaces Drive",
] as const;

export type QuarterlyInvoice = {
  id: string;
  full_number: string | null;
  issue_date: string | null;
  client_name: string | null;
  client_nif: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total: number | null;
  status: string | null;
  verifactu_status: string | null;
  verifactu_csv: string | null;
};

export type QuarterlyExpense = {
  id: string;
  vendor: string;
  category: string | null;
  expense_date: string;
  invoice_reference: string | null;
  vendor_nif: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total: number | null;
  currency: string | null;
};

export type ExpenseAttachment = {
  id?: string;
  expense_id: string;
  name: string;
  web_view_link: string | null;
  storage_path?: string | null;
  size_bytes?: number | null;
};

export type QuarterlyAdvisorData = {
  period: QuarterlyPeriod;
  invoices: QuarterlyInvoice[];
  expenses: QuarterlyExpense[];
  attachments: ExpenseAttachment[];
  attachmentsByExpense: Map<string, ExpenseAttachment[]>;
};

export type QuarterlyTotals = { count: number; base: number; vat: number; total: number };

export type QuarterlyAdvisorDelivery = {
  id: string;
  year: number;
  quarter: number;
  recipient: string;
  attached_pdfs: number;
  mocked: boolean;
  created_at: string;
};

/** Latest quarterly deliveries to the advisor, newest first. */
export async function listQuarterlyAdvisorDeliveries(limit = 12): Promise<QuarterlyAdvisorDelivery[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("quarterly_advisor_deliveries")
    .select("id, year, quarter, recipient, attached_pdfs, mocked, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as QuarterlyAdvisorDelivery[];
}

/** Loads issued invoices, expenses and expense attachments of one calendar quarter. */
export async function loadQuarterlyAdvisorData(
  period: QuarterlyPeriod,
): Promise<QuarterlyAdvisorData> {
  const supabase = await createServerClient();
  const [invoicesResult, expensesResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, full_number, issue_date, client_name, client_nif, subtotal, tax_amount, total, status, verifactu_status, verifactu_csv",
      )
      .is("deleted_at", null)
      .in("status", EXPORTABLE_INVOICE_STATUSES)
      .gte("issue_date", period.start)
      .lt("issue_date", period.end)
      .order("issue_date", { ascending: true })
      .order("full_number", { ascending: true }),
    supabase
      .from("expenses")
      .select(
        "id, vendor, category, expense_date, invoice_reference, vendor_nif, subtotal, tax_amount, total, currency",
      )
      .is("deleted_at", null)
      .gte("expense_date", period.start)
      .lt("expense_date", period.end)
      .order("expense_date", { ascending: true })
      .order("vendor", { ascending: true }),
  ]);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);
  if (expensesResult.error) throw new Error(expensesResult.error.message);

  const invoices = (invoicesResult.data ?? []) as unknown as QuarterlyInvoice[];
  const expenses = (expensesResult.data ?? []) as unknown as QuarterlyExpense[];
  const expenseIds = expenses.map((expense) => expense.id);
  const attachmentsResult =
    expenseIds.length === 0
      ? { data: [] as ExpenseAttachment[], error: null }
      : await supabase
          .from("attachments")
          .select("id, expense_id, name, web_view_link, storage_path, size_bytes")
          .is("deleted_at", null)
          .in("expense_id", expenseIds)
          .order("name", { ascending: true });
  if (attachmentsResult.error) throw new Error(attachmentsResult.error.message);
  const attachments = (attachmentsResult.data ?? []) as unknown as ExpenseAttachment[];

  const attachmentsByExpense = new Map<string, ExpenseAttachment[]>();
  for (const attachment of attachments) {
    const current = attachmentsByExpense.get(attachment.expense_id) ?? [];
    current.push(attachment);
    attachmentsByExpense.set(attachment.expense_id, current);
  }
  return { period, invoices, expenses, attachments, attachmentsByExpense };
}

const amount = (value: number | null) => Math.round(Number(value ?? 0) * 100) / 100;

function attachmentNames(data: QuarterlyAdvisorData, expenseId: string): string {
  return (data.attachmentsByExpense.get(expenseId) ?? []).map((a) => a.name).join(" · ");
}

function attachmentLinks(data: QuarterlyAdvisorData, expenseId: string): string {
  return (data.attachmentsByExpense.get(expenseId) ?? [])
    .map((a) => a.web_view_link)
    .filter((link): link is string => Boolean(link))
    .join(" · ");
}

function sumRows(
  rows: ReadonlyArray<{ subtotal: number | null; tax_amount: number | null; total: number | null }>,
): QuarterlyTotals {
  return rows.reduce<QuarterlyTotals>(
    (acc, row) => ({
      count: acc.count + 1,
      base: amount(acc.base + amount(row.subtotal)),
      vat: amount(acc.vat + amount(row.tax_amount)),
      total: amount(acc.total + amount(row.total)),
    }),
    { count: 0, base: 0, vat: 0, total: 0 },
  );
}

export function quarterlyTotals(data: QuarterlyAdvisorData): {
  invoices: QuarterlyTotals;
  expenses: QuarterlyTotals;
} {
  return { invoices: sumRows(data.invoices), expenses: sumRows(data.expenses) };
}

/** Last calendar day of the quarter (`period.end` is exclusive). */
export function lastDayOf(period: QuarterlyPeriod): string {
  const end = new Date(`${period.end}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

export function quarterlyAdvisorFilename(period: QuarterlyPeriod, extension: "csv" | "xlsx"): string {
  return `doscientos-${period.label.replace(" ", "-")}.${extension}`;
}

/** Single-sheet CSV register combining collections and expenses. */
export function quarterlyAdvisorCsv(data: QuarterlyAdvisorData): Uint8Array {
  const rows = [
    ...data.invoices.map((invoice) => ({
      Tipo: "Cobro",
      "Número / referencia": invoice.full_number ?? "",
      Fecha: invoice.issue_date ?? "",
      Contraparte: invoice.client_name ?? "",
      NIF: invoice.client_nif ?? "",
      Categoría: "",
      Base: amount(invoice.subtotal).toFixed(2),
      IVA: amount(invoice.tax_amount).toFixed(2),
      Total: amount(invoice.total).toFixed(2),
      Estado: invoice.status ?? "",
      "Estado Verifactu": invoice.verifactu_status ?? "",
      "CSV Verifactu": invoice.verifactu_csv ?? "",
      Adjuntos: "PDF disponible para descarga manual desde la factura",
      "Enlaces Drive": "",
    })),
    ...data.expenses.map((expense) => ({
      Tipo: "Gasto",
      "Número / referencia": expense.invoice_reference ?? "",
      Fecha: expense.expense_date,
      Contraparte: expense.vendor,
      NIF: expense.vendor_nif ?? "",
      Categoría: expense.category ?? "",
      Base: amount(expense.subtotal).toFixed(2),
      IVA: amount(expense.tax_amount).toFixed(2),
      Total: amount(expense.total).toFixed(2),
      Estado: "",
      "Estado Verifactu": "",
      "CSV Verifactu": "",
      Adjuntos: attachmentNames(data, expense.id),
      "Enlaces Drive": attachmentLinks(data, expense.id),
    })),
  ];
  return csvWithBom(rows, QUARTERLY_CSV_HEADERS);
}

/** Excel workbook with a summary sheet plus one sheet for issued invoices and one for expenses. */
export function quarterlyAdvisorWorkbook(data: QuarterlyAdvisorData): Buffer {
  const totals = quarterlyTotals(data);
  const summary: XlsxCell[][] = [
    ["Concepto", "Nº documentos", "Base", "IVA", "Total"],
    [
      "Facturas emitidas",
      { integer: totals.invoices.count },
      totals.invoices.base,
      totals.invoices.vat,
      totals.invoices.total,
    ],
    [
      "Gastos",
      { integer: totals.expenses.count },
      totals.expenses.base,
      totals.expenses.vat,
      totals.expenses.total,
    ],
    [
      "Diferencia",
      null,
      amount(totals.invoices.base - totals.expenses.base),
      amount(totals.invoices.vat - totals.expenses.vat),
      amount(totals.invoices.total - totals.expenses.total),
    ],
    [],
    ["Periodo", data.period.label, { date: data.period.start }, { date: lastDayOf(data.period) }],
  ];
  const invoices: XlsxCell[][] = [
    ["Número", "Fecha", "Cliente", "NIF", "Base", "IVA", "Total", "Estado", "Estado Verifactu", "CSV Verifactu"],
    ...data.invoices.map((invoice) => [
      invoice.full_number ?? "",
      invoice.issue_date ? { date: invoice.issue_date } : null,
      invoice.client_name ?? "",
      invoice.client_nif ?? "",
      amount(invoice.subtotal),
      amount(invoice.tax_amount),
      amount(invoice.total),
      invoice.status ?? "",
      invoice.verifactu_status ?? "",
      invoice.verifactu_csv ?? "",
    ]),
  ];
  const expenses: XlsxCell[][] = [
    ["Fecha", "Proveedor", "NIF", "Referencia", "Categoría", "Base", "IVA", "Total", "Moneda", "Adjuntos", "Enlaces Drive"],
    ...data.expenses.map((expense) => [
      { date: expense.expense_date },
      expense.vendor,
      expense.vendor_nif ?? "",
      expense.invoice_reference ?? "",
      expense.category ?? "",
      amount(expense.subtotal),
      amount(expense.tax_amount),
      amount(expense.total),
      expense.currency ?? "EUR",
      attachmentNames(data, expense.id),
      attachmentLinks(data, expense.id),
    ]),
  ];
  return createXlsx([
    { name: "Resumen", rows: summary },
    { name: "Facturas emitidas", rows: invoices },
    { name: "Gastos", rows: expenses },
  ]);
}
