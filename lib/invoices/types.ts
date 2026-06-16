/**
 * Shared types and constants for the invoices domain.
 */

export const INVOICE_LIST_PAGE_SIZE = 25;

// ─── List ─────────────────────────────────────────────────────────────────────

export type InvoiceListItem = {
  id: string;
  full_number: string | null;
  idfact: string | null;
  status: string | null;
  verifactu_status: string | null;
  total: number | null;
  issue_date: string | null;
  due_date: string | null;
  client_name: string | null;
};

export type InvoiceStats = {
  pendingTotal: number;
  pendingCount: number;
  overdueTotal: number;
  overdueCount: number;
  paidMonthTotal: number;
  verifactuKoCount: number;
};

export const INVOICE_SORT_COLUMNS = [
  "full_number",
  "client_name",
  "status",
  "total",
  "issue_date",
  "due_date",
] as const;

export type InvoiceListParams = {
  q?: string;
  status?: string;
  verifactu?: string;
  page?: number;
  sort?: string;
  dir?: "asc" | "desc";
};

export type InvoiceListResult = {
  data: InvoiceListItem[];
  count: number;
  stats: InvoiceStats;
  error: string | null;
};

// ─── Detail ────────────────────────────────────────────────────────────────────

export type InvoiceDetailClient = {
  id: string;
  name: string;
};

export type InvoiceDetailProject = {
  id: string;
  name: string;
};

export type InvoiceLineItem = {
  id: string;
  position: number | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  subtotal: number | null;
};

export type InvoiceSettings = {
  company_name: string | null;
  company_nif: string | null;
  company_address: string | null;
  iban: string | null;
};

export type InvoiceDetail = {
  id: string;
  full_number: string | null;
  idfact: string | null;
  invoice_type: string | null;
  status: string | null;
  verifactu_status: string | null;
  verifactu_csv: string | null;
  subtotal: number | null;
  total: number | null;
  issue_date: string | null;
  due_date: string | null;
  client_nif: string | null;
  client: InvoiceDetailClient | null;
  project: InvoiceDetailProject | null;
};

export type InvoiceDetailResult = {
  invoice: InvoiceDetail;
  items: InvoiceLineItem[];
  settings: InvoiceSettings | null;
} | null;
