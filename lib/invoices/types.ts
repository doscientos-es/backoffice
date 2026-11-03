/**
 * Shared types and constants for the invoices domain.
 */

export const INVOICE_LIST_PAGE_SIZE = 25

// ─── List ─────────────────────────────────────────────────────────────────────

type InvoiceListItem = {
  id: string
  client_id: string
  full_number: string | null
  idfact: string | null
  concepts: string[]
  status: string | null
  verifactu_status: string | null
  total: number | null
  issue_date: string | null
  due_date: string | null
  client_name: string | null
  proposal_id: string | null
  proposal_title: string | null
  proposal_number: string | null
  proposal_url: string | null
}

type InvoiceStats = {
  pendingTotal: number
  pendingCount: number
  overdueTotal: number
  overdueCount: number
  paidMonthTotal: number
  verifactuKoCount: number
}

export const INVOICE_SORT_COLUMNS = [
  'full_number',
  'client_name',
  'status',
  'total',
  'issue_date',
  'due_date',
] as const

export type InvoiceListParams = {
  q?: string
  status?: string
  verifactu?: string
  leadId?: string
  page?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type InvoiceListResult = {
  data: InvoiceListItem[]
  count: number
  stats: InvoiceStats
  error: string | null
}

// ─── Detail ────────────────────────────────────────────────────────────────────

type InvoiceDetailClient = {
  id: string
  name: string
  logo_url: string | null
}

type InvoiceDetailProject = {
  id: string
  name: string
}

type InvoiceLineItem = {
  id: string
  position: number | null
  description: string | null
  quantity: number | null
  unit_price: number | null
  vat_rate: number | null
  subtotal: number | null
}

type InvoiceSettings = {
  company_name: string | null
  company_nif: string | null
  company_address: string | null
  iban: string | null
  payment_terms: string | null
}

type InvoiceDetail = {
  id: string
  full_number: string | null
  idfact: string | null
  invoice_type: string | null
  status: string | null
  verifactu_status: string | null
  verifactu_csv: string | null
  qr_url: string | null
  subtotal: number | null
  total: number | null
  issue_date: string | null
  due_date: string | null
  client_nif: string | null
  client_address_street: string | null
  client_address_zip: string | null
  client_address_city: string | null
  client_address_province: string | null
  client_address_country: string | null
  payment_terms: string | null
  client: InvoiceDetailClient | null
  project: InvoiceDetailProject | null
}

export type InvoiceDetailResult = {
  invoice: InvoiceDetail
  items: InvoiceLineItem[]
  settings: InvoiceSettings | null
} | null

// ─── Query-level shapes (read) ────────────────────────────────────────────────

/** Proposal header needed when creating a derived invoice. */
export type ProposalForInvoice = {
  id: string
  client_id: string
  project_id: string | null
  status: string
  title: string | null
  notes: string | null
  payment_schedule: string | null
  payment_plan: unknown
}

/** Proposal line item shape used during invoice creation. */
export type ProposalItem = {
  position: number
  description: string | null
  quantity: number
  unit_price: number
  vat_rate: number
  billing_cycle: string | null
}

/** Client snapshot denormalized onto new invoices. */
export type ClientInfo = {
  name: string | null
  nif: string | null
  billing_address_street: string | null
  billing_address_zip: string | null
  billing_address_city: string | null
  billing_address_province: string | null
  billing_address_country: string | null
}

/** Invoice row used to prefill and send the client portal email. */
export type InvoiceForEmail = {
  id: string
  full_number: string | null
  total: number | null
  due_date: string | null
  status: string
  portal_token: string | null
  is_client_visible: boolean
  client: {
    name: string
    email: string | null
    phone: string | null
    leads: { language: 'es' | 'ca' | 'en' | null } | null
  } | null
}

/** Channels the invoice portal link can be delivered through. */
export type InvoiceDeliveryChannel = 'email' | 'whatsapp'

/** Append-only record of an invoice delivery to the client. */
export type InvoiceDelivery = {
  id: string
  channel: InvoiceDeliveryChannel
  recipient: string | null
  attached_pdf: boolean
  mocked: boolean
  created_at: string
  sent_by_name: string | null
}

// ─── Query-level shapes (write) ───────────────────────────────────────────────

/** Fields patched when an invoice's status changes. */
export type InvoiceStatusPatch = {
  status: string
  updated_at: string
  paid_at: string | null
  payment_method?: string | null
  issued_at?: string
  // Client snapshot — refreshed on first issuance so draft edits to the client are captured.
  client_nif?: string | null
  client_name?: string | null
  client_address_street?: string | null
  client_address_zip?: string | null
  client_address_city?: string | null
  client_address_province?: string | null
  client_address_country?: string | null
}

/** Data required to insert a new invoice row. */
export type NewInvoiceData = {
  client_id: string
  project_id: string | null
  proposal_id?: string | null
  proposal_payment_plan_item_id?: string | null
  series: string
  status: 'draft'
  currency: 'EUR'
  subtotal: number
  tax_amount: number
  total: number
  due_date?: string | null
  client_nif: string | null
  client_name: string | null
  client_address_street: string | null
  client_address_zip: string | null
  client_address_city: string | null
  client_address_province: string | null
  client_address_country: string | null
  notes?: string | null
  payment_terms?: string | null
  created_by: string
}

/** Single line item used when inserting invoice_items rows. */
export type InvoiceItemInsert = {
  position: number
  description: string | null
  quantity: number
  unit_price: number
  vat_rate: number
}
