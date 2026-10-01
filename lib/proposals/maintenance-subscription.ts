import type { SupabaseClient } from '@supabase/supabase-js'

import { parseMaintenanceOffer, selectedMaintenancePlan } from '@/lib/proposals/maintenance'
import { recurringAmount } from '@/lib/proposals/recurring'

// biome-ignore lint/suspicious/noExplicitAny: structural compatibility across client variants
type AnyClient = SupabaseClient<any, any, any>

type Result = { ok: true; id: string | null } | { ok: false; error: string }

/**
 * Creates (paused) the maintenance subscription of an accepted proposal, or
 * returns the existing one. Returns `id: null` when the proposal has no
 * selected maintenance plan and `requirePlan` is false.
 */
export async function ensureProposalMaintenanceSubscription(
  supabase: AnyClient,
  proposalId: string,
  createdBy: string | null,
  { requirePlan = true }: { requirePlan?: boolean } = {},
): Promise<Result> {
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select(
      'id, number, title, status, client_id, project_id, responded_at, maintenance_options, maintenance_selected_plan_id',
    )
    .eq('id', proposalId)
    .is('deleted_at', null)
    .maybeSingle()
  if (proposalError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status !== 'accepted') {
    return { ok: false, error: 'La propuesta debe estar aceptada para crear la suscripción' }
  }
  if (!proposal.client_id) {
    return { ok: false, error: 'La propuesta aceptada no tiene cliente facturable' }
  }

  const findExisting = () =>
    supabase
      .from('subscriptions')
      .select('id')
      .eq('proposal_id', proposalId)
      .is('deleted_at', null)
      .maybeSingle()

  const { data: existing, error: existingError } = await findExisting()
  if (existingError) return { ok: false, error: existingError.message }
  if (existing) return { ok: true, id: existing.id as string }

  const offer = parseMaintenanceOffer(proposal.maintenance_options)
  const plan = selectedMaintenancePlan(
    offer,
    (proposal.maintenance_selected_plan_id as string | null) ?? null,
  )
  if (!plan) {
    return requirePlan
      ? { ok: false, error: 'La propuesta no tiene un plan de mantenimiento seleccionado' }
      : { ok: true, id: null }
  }

  const startDate = ((proposal.responded_at as string | null) ?? new Date().toISOString()).slice(
    0,
    10,
  )
  const { data: subscription, error: insertError } = await supabase
    .from('subscriptions')
    .insert({
      proposal_id: proposal.id,
      client_id: proposal.client_id,
      project_id: proposal.project_id ?? null,
      name: `Mantenimiento web · ${plan.name}`,
      description: plan.summary,
      // The maintenance contract is prepared when the proposal is accepted,
      // but billing starts only when the client signs the delivery note.
      status: 'paused',
      billing_cycle: offer.billing_cycle,
      amount: recurringAmount(plan.monthly_price, offer.billing_cycle),
      vat_rate: plan.vat_rate,
      start_date: startDate,
      next_invoice_date: startDate,
      notes: `Creada desde ${proposal.number ?? proposal.title}. Se activa al firmar el cliente el albarán de entrega. La cuota se actualizará anualmente conforme al IPC indicado en los términos de la propuesta.`,
      created_by: createdBy,
    })
    .select('id')
    .single()
  if (insertError || !subscription) {
    if (insertError?.code === '23505') {
      const { data: duplicate } = await findExisting()
      if (duplicate) return { ok: true, id: duplicate.id as string }
    }
    return { ok: false, error: insertError?.message ?? 'No se pudo crear la suscripción' }
  }
  return { ok: true, id: subscription.id as string }
}

/**
 * Activates the maintenance subscription of a delivered proposal. Billing
 * starts on the delivery date. A no-op (`id: null`) without maintenance plan;
 * cancelled subscriptions are left untouched.
 */
export async function activateProposalMaintenanceSubscription(
  supabase: AnyClient,
  proposalId: string,
  deliveredAt: string,
): Promise<Result> {
  const ensured = await ensureProposalMaintenanceSubscription(supabase, proposalId, null, {
    requirePlan: false,
  })
  if (!ensured.ok || !ensured.id) return ensured

  const startDate = deliveredAt.slice(0, 10)
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'active', start_date: startDate, next_invoice_date: startDate })
    .eq('id', ensured.id)
    .eq('status', 'paused')
  if (error) return { ok: false, error: error.message }
  return ensured
}
