/**
 * Shared types and constants for the clients domain.
 */

export const CLIENT_LIST_PAGE_SIZE = 25;
export const CLIENT_PROJECTS_LIMIT = 20;
export const CLIENT_RELATED_LIMIT = 10;

// ─── List ─────────────────────────────────────────────────────────────────────

export type ClientListItem = {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  updated_at: string | null;
};

export const CLIENT_SORT_COLUMNS = ["name", "nif", "email", "created_at"] as const;

export type ClientListParams = {
  q?: string;
  page?: number;
  sort?: string;
  dir?: "asc" | "desc";
};

export type ClientListResult = {
  data: ClientListItem[];
  count: number;
};

// ─── Detail (related rows) ────────────────────────────────────────────────────

export type ClientProjectItem = {
  id: string;
  name: string;
  status: string | null;
};

export type ClientProposalItem = {
  id: string;
  number: string | null;
  title: string | null;
  status: string | null;
  total: number | null;
};

export type ClientInvoiceItem = {
  id: string;
  full_number: string | null;
  status: string | null;
  total: number | null;
  issue_date: string | null;
};

// ─── Full client record ────────────────────────────────────────────────────────

export type ClientDetail = {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  billing_address: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ClientDetailResult = {
  client: ClientDetail;
  projects: ClientProjectItem[];
  proposals: ClientProposalItem[];
  invoices: ClientInvoiceItem[];
} | null;
