import 'server-only'
import {
  computeLineTotals,
  netOneTimeAmounts,
  type BillingCycle,
  type DiscountType,
} from '@/lib/finance'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { effectivePaymentPlan, splitItemsForPaymentPlan } from '@/lib/proposals/scope'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Creates the missing editable invoice drafts for an accepted proposal.
 * A proposal without a configured schedule is billed in a single 100% draft.
 */
export async function createProposalDraftInvoices(
  supabase: AdminClient,
  proposalId: string,
  createdBy: string | null,
): Promise<{ ids: string[]; created: number }> {
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select(
      'id, client_id, project_id, status, notes, payment_schedule, payment_plan, discount_type, discount_value',
    )
    .eq('id', proposalId)
    .is('deleted_at', null)
    .maybeSingle()
  if (proposalError) throw new Error(proposalError.message)
  if (!proposal) throw new Error('Propuesta no encontrada')
  if (proposal.status !== 'accepted')
    throw new Error('Solo se puede facturar una propuesta aceptada')
  if (!proposal.client_id) throw new Error('La propuesta aceptada no tiene cliente facturable')

  const effectivePlan = effectivePaymentPlan(proposal.payment_plan, proposal.payment_schedule)

  const [itemsResult, clientResult, settingsResult, existingResult] = await Promise.all([
    supabase
      .from('proposal_items')
      .select('description, quantity, unit_price, vat_rate, billing_cycle, discount_percent')
      .eq('proposal_id', proposalId)
      .order('position'),
    supabase
      .from('clients')
      .select(
        'name, nif, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country',
      )
      .eq('id', proposal.client_id)
      .maybeSingle(),
    supabase.from('settings').select('invoice_series').eq('id', 1).maybeSingle(),
    supabase
      .from('invoices')
      .select('proposal_payment_plan_item_id')
      .eq('proposal_id', proposalId)
      .is('deleted_at', null)
      .not('proposal_payment_plan_item_id', 'is', null),
  ])
  if (itemsResult.error) throw new Error(itemsResult.error.message)
  if (existingResult.error) throw new Error(existingResult.error.message)

  const rawItems = (itemsResult.data ?? []).map((item) => ({
    description: (item.description as string | null) ?? null,
    quantity: Number(item.quantity ?? 0),
    unit_price: Number(item.unit_price ?? 0),
    vat_rate: Number(item.vat_rate ?? 0),
    billing_cycle: ((item.billing_cycle as string | null) ?? 'none') as BillingCycle,
    discount_percent: Number(item.discount_percent ?? 0),
  }))
  // Invoices carry the NET amount (line + proposal discounts already applied),
  // so they always add up to the accepted proposal total.
  const netAmounts = netOneTimeAmounts(rawItems, {
    type: ((proposal.discount_type as string | null) ?? 'none') as DiscountType,
    value: Number(proposal.discount_value ?? 0),
  })
  const items = rawItems.flatMap((item, index) => {
    const net = netAmounts[index]
    if (net === null || net === undefined) return []
    const discounted = item.discount_percent > 0 || Number(proposal.discount_value ?? 0) > 0
    return [
      {
        description: item.description,
        quantity: discounted ? 1 : item.quantity,
        unit_price: discounted ? net : item.unit_price,
        vat_rate: item.vat_rate,
        billing_cycle: item.billing_cycle,
      },
    ]
  })
  if (items.length === 0) throw new Error('La propuesta no tiene líneas puntuales para facturar')

  const alreadyInvoiced = new Set(
    (existingResult.data ?? [])
      .map((invoice) => invoice.proposal_payment_plan_item_id as string | null)
      .filter((id): id is string => Boolean(id)),
  )
  const client = clientResult.data
  const series = ((settingsResult.data?.invoice_series as string | null) ?? 'A').trim() || 'A'
  const ids: string[] = []

  for (const [index, milestone] of effectivePlan.entries()) {
    if (alreadyInvoiced.has(milestone.id)) continue
    const invoiceItems = splitItemsForPaymentPlan(items, effectivePlan, index)
    if (invoiceItems.length === 0) continue

    const { subtotal, taxAmount, total } = computeLineTotals(invoiceItems)
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        client_id: proposal.client_id,
        project_id: proposal.project_id,
        proposal_id: proposal.id,
        proposal_payment_plan_item_id: milestone.id,
        series,
        status: 'draft',
        currency: 'EUR',
        subtotal,
        tax_amount: taxAmount,
        total,
        due_date: milestone.due_date ?? null,
        client_nif: client?.nif ?? null,
        client_name: client?.name ?? null,
        client_address_street: client?.billing_address_street ?? null,
        client_address_zip: client?.billing_address_zip ?? null,
        client_address_city: client?.billing_address_city ?? null,
        client_address_province: client?.billing_address_province ?? null,
        client_address_country: client?.billing_address_country ?? null,
        notes: proposal.notes,
        payment_terms: `${milestone.title} · ${milestone.percentage} %`,
        created_by: createdBy,
      })
      .select('id')
      .single()
    if (invoiceError || !invoice)
      throw new Error(invoiceError?.message ?? 'No se pudo crear la factura')

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems.map((item, position) => ({ ...item, position, invoice_id: invoice.id })))
    if (itemsError) throw new Error(itemsError.message)
    ids.push(invoice.id as string)
  }

  return { ids, created: ids.length }
}

/**
 * Tells the lead owner that the first invoice draft of a signed proposal is
 * ready to be issued. Falls back to owners/admins when the proposal has no
 * linked lead owner. Best-effort: never throws.
 */
export async function notifyInvoiceDraftsReady(
  supabase: AdminClient,
  proposalId: string,
  invoiceIds: string[],
): Promise<void> {
  if (!invoiceIds.length) return
  try {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('title, lead_id, client_id, clients(name, lead_id)')
      .eq('id', proposalId)
      .maybeSingle()
    if (!proposal) return

    const client = (
      proposal as unknown as { clients?: { name?: string | null; lead_id?: string | null } | null }
    ).clients
    const leadId = (proposal.lead_id as string | null) ?? client?.lead_id ?? null
    let recipientIds: string[] = []
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('assigned_to')
        .eq('id', leadId)
        .maybeSingle()
      if (lead?.assigned_to) recipientIds = [lead.assigned_to as string]
    }
    if (!recipientIds.length) {
      const { data: admins } = await supabase
        .from('team_members')
        .select('id')
        .in('role', ['owner', 'admin'])
        .is('deleted_at', null)
      recipientIds = (admins ?? []).map((m) => m.id as string)
    }

    const label = [proposal.title as string | null, client?.name].filter(Boolean).join(' · ')
    await dispatchNotifications({
      recipientIds,
      eventType: 'invoice_draft_ready',
      entityType: 'invoice',
      entityId: invoiceIds[0] as string,
      body: `${label || 'Propuesta firmada'}: factura en borrador lista para emitir.`,
      link: `/invoices/${invoiceIds[0]}`,
    })
  } catch {
    // Notification failures must never affect the signed proposal.
  }
}
