import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'
import { escapeIlike } from '@/lib/utils/search-params'

import type { InvoicePdfWorkLogInput } from './pdf-data'
import {
  type ClientInfo,
  INVOICE_LIST_PAGE_SIZE,
  type InvoiceDelivery,
  type InvoiceDeliveryChannel,
  type InvoiceDetailResult,
  type InvoiceForEmail,
  type InvoiceItemInsert,
  type InvoiceListParams,
  type InvoiceListResult,
  type InvoiceStatusPatch,
  type NewInvoiceData,
  type ProposalForInvoice,
  type ProposalItem,
} from './types'

const log = scopedLogger('invoices.queries')

type InvoiceConceptRow = {
  description: string | null
  position: number | null
}

export function invoiceConcepts(items: InvoiceConceptRow[] | null | undefined): string[] {
  return [...(items ?? [])]
    .sort(
      (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER),
    )
    .map((item) => item.description?.trim() ?? '')
    .filter(Boolean)
}

export async function listInvoices(params: InvoiceListParams): Promise<InvoiceListResult> {
  const supabase = await createServerClient()
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * INVOICE_LIST_PAGE_SIZE
  const to = from + INVOICE_LIST_PAGE_SIZE - 1

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const [listRes, pendingRes, overdueRes, paidMonthRes, verifactuKoRes] = await Promise.all([
    (async () => {
      // Summary queries do not depend on the lead-to-client lookup.
      const { data: leadClient } = params.leadId
        ? await notDeleted(
            supabase.from('clients').select('id').eq('lead_id', params.leadId),
          ).maybeSingle()
        : { data: null }
      let query = notDeleted(
        supabase
          .from('invoices')
          .select(
            'id, client_id, full_number, idfact, status, verifactu_status, total, issue_date, due_date, client_name, proposal_id, proposals(id, number, title), invoice_items(description, position)',
            { count: 'exact' },
          ),
      )
      if (params.q && params.q.length > 0) {
        const pattern = `%${escapeIlike(params.q)}%`
        query = query.or(
          `full_number.ilike.${pattern},idfact.ilike.${pattern},client_name.ilike.${pattern}`,
        )
      }
      if (params.status) query = query.eq('status', params.status)
      if (params.verifactu) query = query.eq('verifactu_status', params.verifactu)
      if (params.leadId)
        query = leadClient ? query.eq('client_id', leadClient.id) : query.is('id', null)
      const sortCol = params.sort ?? 'issue_date'
      const ascending = params.dir === 'asc'
      return query.order(sortCol, { ascending, nullsFirst: false }).range(from, to)
    })(),
    notDeleted(supabase.from('invoices').select('total', { count: 'exact' })).eq(
      'status',
      'issued',
    ),
    notDeleted(supabase.from('invoices').select('total', { count: 'exact' })).eq(
      'status',
      'overdue',
    ),
    notDeleted(supabase.from('invoices').select('total'))
      .eq('status', 'paid')
      .gte('issue_date', monthStart),
    notDeleted(supabase.from('invoices').select('id', { count: 'exact', head: true })).in(
      'verifactu_status',
      ['rejected', 'error'],
    ),
  ])

  if (listRes.error) log.error({ err: listRes.error.message }, 'list_invoices_failed')

  const pendingTotal = (pendingRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)
  const overdueTotal = (overdueRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)
  const paidMonthTotal = (paidMonthRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)

  return {
    data: (listRes.data ?? []).map((i) => ({
      id: i.id as string,
      client_id: i.client_id as string,
      full_number: (i.full_number as string | null) ?? null,
      idfact: (i.idfact as string | null) ?? null,
      concepts: invoiceConcepts(
        (
          i as unknown as {
            invoice_items: InvoiceConceptRow[] | null
          }
        ).invoice_items,
      ),
      status: (i.status as string | null) ?? null,
      verifactu_status: (i.verifactu_status as string | null) ?? null,
      total: i.total == null ? null : Number(i.total),
      issue_date: (i.issue_date as string | null) ?? null,
      due_date: (i.due_date as string | null) ?? null,
      client_name: (i.client_name as string | null) ?? null,
      proposal_id: (i.proposal_id as string | null) ?? null,
      proposal_title:
        (i.proposals as unknown as Array<{ title: string | null }> | null)?.[0]?.title ?? null,
      proposal_number:
        (i.proposals as unknown as Array<{ number: string | null }> | null)?.[0]?.number ?? null,
      proposal_url: i.proposal_id ? `/proposals/${i.proposal_id}` : null,
    })),
    count: listRes.count ?? 0,
    stats: {
      pendingTotal,
      pendingCount: pendingRes.count ?? 0,
      overdueTotal,
      overdueCount: overdueRes.count ?? 0,
      paidMonthTotal,
      verifactuKoCount: verifactuKoRes.count ?? 0,
    },
    error: listRes.error?.message ?? null,
  }
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetailResult> {
  const supabase = await createServerClient()

  const { data: invoice, error } = await notDeleted(
    supabase
      .from('invoices')
      .select('*, clients(id, name, logo_url), projects(id, name)')
      .eq('id', id),
  ).maybeSingle()

  if (error) log.error({ invoiceId: id, err: error.message }, 'get_invoice_detail_failed')
  if (!invoice) return null

  const [{ data: items }, { data: settings }] = await Promise.all([
    supabase
      .from('invoice_items')
      .select('id, position, description, quantity, unit_price, vat_rate, subtotal')
      .eq('invoice_id', id)
      .order('position'),
    supabase
      .from('settings')
      .select('company_name, company_nif, company_address, iban, payment_terms')
      .eq('id', 1)
      .single(),
  ])

  const client =
    (
      invoice as unknown as {
        clients: { id: string; name: string; logo_url: string | null } | null
      }
    ).clients ?? null
  const project =
    (invoice as unknown as { projects: { id: string; name: string } | null }).projects ?? null

  return {
    invoice: {
      id: invoice.id as string,
      full_number: (invoice.full_number as string | null) ?? null,
      idfact: (invoice.idfact as string | null) ?? null,
      invoice_type: (invoice.invoice_type as string | null) ?? null,
      status: (invoice.status as string | null) ?? null,
      verifactu_status: (invoice.verifactu_status as string | null) ?? null,
      verifactu_csv: (invoice.verifactu_csv as string | null) ?? null,
      qr_url: (invoice.qr_url as string | null) ?? null,
      subtotal: invoice.subtotal == null ? null : Number(invoice.subtotal),
      total: invoice.total == null ? null : Number(invoice.total),
      issue_date: (invoice.issue_date as string | null) ?? null,
      due_date: (invoice.due_date as string | null) ?? null,
      client_nif: (invoice.client_nif as string | null) ?? null,
      client_address_street: (invoice.client_address_street as string | null) ?? null,
      client_address_zip: (invoice.client_address_zip as string | null) ?? null,
      client_address_city: (invoice.client_address_city as string | null) ?? null,
      client_address_province: (invoice.client_address_province as string | null) ?? null,
      client_address_country: (invoice.client_address_country as string | null) ?? null,
      payment_terms: (invoice.payment_terms as string | null) ?? null,
      client,
      project,
    },
    items: (items ?? []).map((item) => ({
      id: item.id as string,
      position: (item.position as number | null) ?? null,
      description: (item.description as string | null) ?? null,
      quantity: (item.quantity as number | null) ?? null,
      unit_price: (item.unit_price as number | null) ?? null,
      vat_rate: (item.vat_rate as number | null) ?? null,
      subtotal: (item.subtotal as number | null) ?? null,
    })),
    settings: settings
      ? {
          company_name: (settings.company_name as string | null) ?? null,
          company_nif: (settings.company_nif as string | null) ?? null,
          company_address: (settings.company_address as string | null) ?? null,
          iban: (settings.iban as string | null) ?? null,
          payment_terms: (settings.payment_terms as string | null) ?? null,
        }
      : null,
  }
}

// ─── Status / soft-delete mutations ──────────────────────────────────────────

/**
 * Overwrites the client snapshot fields on a draft invoice with fresh data
 * from the client record. The `.eq("status", "draft")` guard is an extra
 * safety net on top of the `fn_check_invoice_immutable` trigger.
 */
export async function patchInvoiceClientSnapshot(
  id: string,
  snapshot: {
    client_nif: string | null
    client_name: string | null
    client_address_street: string | null
    client_address_zip: string | null
    client_address_city: string | null
    client_address_province: string | null
    client_address_country: string | null
  },
): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('invoices')
    .update({ ...snapshot, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
  if (error) throw new Error(error.message)
}

/** Applies a status/timestamp patch to an invoice row. Throws on DB error. */
export async function patchInvoiceStatus(id: string, patch: InvoiceStatusPatch): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase.from('invoices').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Soft-deletes an invoice by stamping `deleted_at`. Throws on DB error. */
export async function softDeleteInvoice(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Clears `deleted_at`, reversing a soft-delete. Throws on DB error. */
export async function restoreDeletedInvoice(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase.from('invoices').update({ deleted_at: null }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Invoice creation helpers ─────────────────────────────────────────────────

/** Returns the proposal header needed to create a derived invoice. */
export async function findProposalForInvoice(
  proposalId: string,
): Promise<ProposalForInvoice | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('proposals')
    .select('id, client_id, project_id, status, title, notes, payment_schedule, payment_plan')
    .eq('id', proposalId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    client_id: data.client_id as string,
    project_id: (data.project_id as string | null) ?? null,
    status: data.status as string,
    title: (data.title as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    payment_schedule: (data.payment_schedule as string | null) ?? null,
    payment_plan: data.payment_plan,
  }
}

/** Plan item ids which already own a non-deleted invoice for this proposal. */
export async function findInvoicedProposalPaymentPlanIds(proposalId: string): Promise<Set<string>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('proposal_payment_plan_item_id')
    .eq('proposal_id', proposalId)
    .is('deleted_at', null)
    .not('proposal_payment_plan_item_id', 'is', null)
  if (error) throw new Error(error.message)
  return new Set(
    (data ?? [])
      .map((invoice) => invoice.proposal_payment_plan_item_id as string | null)
      .filter((id): id is string => Boolean(id)),
  )
}

/** Returns all line items for a proposal, ordered by position. */
export async function findProposalItems(proposalId: string): Promise<ProposalItem[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('proposal_items')
    .select('position, description, quantity, unit_price, vat_rate, billing_cycle')
    .eq('proposal_id', proposalId)
    .order('position')
  if (error) throw new Error(error.message)
  return (data ?? []).map((it) => ({
    position: it.position as number,
    description: (it.description as string | null) ?? null,
    quantity: Number(it.quantity ?? 0),
    unit_price: Number(it.unit_price ?? 0),
    vat_rate: Number(it.vat_rate ?? 0),
    billing_cycle: (it.billing_cycle as string | null) ?? null,
  }))
}

/** Returns client snapshot fields denormalized onto invoices. */
export async function findClientInfo(clientId: string): Promise<ClientInfo | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('clients')
    .select(
      'name, nif, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country',
    )
    .eq('id', clientId)
    .maybeSingle()
  if (!data) return null
  return {
    name: (data.name as string | null) ?? null,
    nif: (data.nif as string | null) ?? null,
    billing_address_street: (data.billing_address_street as string | null) ?? null,
    billing_address_zip: (data.billing_address_zip as string | null) ?? null,
    billing_address_city: (data.billing_address_city as string | null) ?? null,
    billing_address_province: (data.billing_address_province as string | null) ?? null,
    billing_address_country: (data.billing_address_country as string | null) ?? null,
  }
}

/**
 * Returns the configured invoice series from the singleton settings row,
 * defaulting to `"A"` when absent or blank.
 */
export async function findInvoiceSeries(): Promise<string> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('settings')
    .select('invoice_series')
    .eq('id', 1)
    .maybeSingle()
  return ((data?.invoice_series as string | null) ?? 'A').trim() || 'A'
}

/**
 * Inserts a new invoice row and its line items.
 * Returns the new invoice `id`. Throws on any DB error.
 *
 * Note: Supabase JS does not expose explicit transactions; items are inserted
 * after the invoice. A failure on items is logged but does not roll back the
 * invoice — the caller is responsible for cleanup if needed.
 */
export async function insertInvoiceWithItems(
  invoiceData: NewInvoiceData,
  items: InvoiceItemInsert[],
): Promise<{ id: string }> {
  const supabase = await createServerClient()
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(invoiceData)
    .select('id')
    .single()
  if (invoiceError || !invoice)
    throw new Error(invoiceError?.message ?? 'No se pudo crear la factura')

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(items.map((it) => ({ ...it, invoice_id: invoice.id as string })))
  if (itemsError) {
    log.error({ err: itemsError, invoiceId: invoice.id }, 'insert_invoice_items_failed')
    throw new Error(itemsError.message)
  }

  return { id: invoice.id as string }
}

// ─── Work logs ────────────────────────────────────────────────────────────────

/**
 * Returns the work logs linked to an invoice, with member name, ordered by
 * date. Used to render the tracked-hours breakdown page of the invoice PDF.
 */
export async function findWorkLogsForInvoice(invoiceId: string): Promise<InvoicePdfWorkLogInput[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('work_logs')
    .select('work_date, hours, start_time, end_time, note, team_members:member_id(name)')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('work_date', { ascending: true })
  if (error) {
    log.error({ invoiceId, err: error.message }, 'find_work_logs_for_invoice_failed')
    return []
  }
  return (data ?? []).map((w) => {
    const member = w.team_members as unknown as { name: string } | null
    return {
      work_date: (w.work_date as string | null) ?? null,
      member_name: member?.name ?? null,
      start_time: ((w.start_time as string | null) ?? null)?.slice(0, 5) ?? null,
      end_time: ((w.end_time as string | null) ?? null)?.slice(0, 5) ?? null,
      hours: Number(w.hours ?? 0),
      note: (w.note as string | null) ?? null,
    }
  })
}

// ─── Invoice edit helpers ─────────────────────────────────────────────────────

/**
 * Returns the current status of an invoice so the caller can guard edits.
 * Returns `null` when the invoice does not exist.
 */
export async function findInvoiceForEdit(id: string): Promise<{ status: string } | null> {
  const supabase = await createServerClient()
  const { data } = await supabase.from('invoices').select('status').eq('id', id).single()
  if (!data) return null
  return { status: data.status as string }
}

// ─── Email helpers ────────────────────────────────────────────────────────────

/**
 * Returns the invoice fields needed to compose and send the client portal email.
 * Returns `null` when the invoice is deleted or does not exist.
 */
export async function findInvoiceForEmail(id: string): Promise<InvoiceForEmail | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, full_number, total, due_date, status, portal_token, is_client_visible, clients(name, email, phone, lead_id, leads(language))',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) log.error({ invoiceId: id, err: error.message }, 'find_invoice_for_email_failed')
  if (!data) return null

  const rawClient = (
    data as unknown as {
      clients: {
        name: string
        email: string | null
        phone: string | null
        lead_id: string | null
        leads: { language: 'es' | 'ca' | 'en' | null } | null
      } | null
    }
  ).clients
  return {
    id: data.id as string,
    full_number: (data.full_number as string | null) ?? null,
    total: data.total == null ? null : Number(data.total),
    due_date: (data.due_date as string | null) ?? null,
    status: data.status as string,
    portal_token: (data.portal_token as string | null) ?? null,
    is_client_visible: Boolean(data.is_client_visible),
    client: rawClient ?? null,
  }
}

// ─── Delivery log ─────────────────────────────────────────────────────────────

/** Appends a delivery record so the team can audit what the client received. */
export async function insertInvoiceDelivery(entry: {
  invoiceId: string
  channel: InvoiceDeliveryChannel
  recipient: string | null
  attachedPdf?: boolean
  providerMessageId?: string | null
  mocked?: boolean
  sentBy: string
}): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase.from('invoice_deliveries').insert({
    invoice_id: entry.invoiceId,
    channel: entry.channel,
    recipient: entry.recipient,
    attached_pdf: entry.attachedPdf ?? false,
    provider_message_id: entry.providerMessageId ?? null,
    mocked: entry.mocked ?? false,
    sent_by: entry.sentBy,
  })
  if (error)
    log.error(
      { invoiceId: entry.invoiceId, channel: entry.channel, err: error.message },
      'insert_invoice_delivery_failed',
    )
}

/** Returns the invoice deliveries, most recent first. */
export async function findInvoiceDeliveries(invoiceId: string): Promise<InvoiceDelivery[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('invoice_deliveries')
    .select('id, channel, recipient, attached_pdf, mocked, created_at, team_members(name)')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })
  if (error) {
    log.error({ invoiceId, err: error.message }, 'find_invoice_deliveries_failed')
    return []
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    channel: row.channel as InvoiceDeliveryChannel,
    recipient: (row.recipient as string | null) ?? null,
    attached_pdf: Boolean(row.attached_pdf),
    mocked: Boolean(row.mocked),
    created_at: row.created_at as string,
    sent_by_name:
      (row as unknown as { team_members: { name: string } | null }).team_members?.name ?? null,
  }))
}
