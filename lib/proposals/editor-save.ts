import { revalidatePath } from 'next/cache'
import 'server-only'

import { requirePermission } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { isProposalEditable } from '@/lib/proposals/items'
import { parseMaintenanceOffer, selectedMaintenancePlan } from '@/lib/proposals/maintenance'
import { ensureCalendarYearProration, recurringPaymentTerms } from '@/lib/proposals/recurring'
import { formatProposalValidationIssues } from '@/lib/proposals/validation'
import { UpdateProposalInput, UpdateProposalTeamInput } from '@/lib/schemas/proposal'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('proposals')

type UpdateResult = { ok: true; version: number } | { ok: false; error: string; code?: 'conflict' }

/**
 * Patches a proposal in place. Used by the inline editor loop.
 * Accepts a partial payload; when `items` is present the line items are
 * replaced atomically (delete + insert) and totals recomputed server-side.
 *
 * Locked once the proposal is `accepted` or `rejected`.
 */
export async function updateProposalRecord(input: unknown): Promise<UpdateResult> {
  await requirePermission('proposals.write')
  await requirePermission('proposals.prices')

  const parsed = UpdateProposalInput.safeParse(input)
  if (!parsed.success) {
    const errors = formatProposalValidationIssues(parsed.error.issues)
    return { ok: false, error: errors.join('\n') || 'Datos de la propuesta no válidos' }
  }
  const { id, expected_version, items, ...rest } = parsed.data

  const maintenanceOffer = parseMaintenanceOffer(rest.maintenance_options)
  if (
    rest.maintenance_selected_plan_id &&
    !selectedMaintenancePlan(maintenanceOffer, rest.maintenance_selected_plan_id)
  ) {
    return { ok: false, error: 'Mantenimiento: el plan seleccionado no existe en esta propuesta' }
  }

  const supabase = await createServerClient()

  const { data: current, error: readError } = await supabase
    .from('proposals')
    .select('status, created_at, payment_schedule')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (readError || !current) return { ok: false, error: 'Propuesta no encontrada' }
  const { data: priceFields, error: priceError } = await supabase
    .from('proposal_prices')
    .select('payment_terms')
    .eq('proposal_id', id)
    .maybeSingle()
  if (priceError || !priceFields) {
    return { ok: false, error: 'No se pudo cargar la información económica de la propuesta' }
  }
  if (!isProposalEditable(current.status)) {
    return { ok: false, error: 'La propuesta ya ha sido respondida y no se puede editar' }
  }

  const persistedItems = items
    ? ensureCalendarYearProration(items, current.created_at as string | null)
    : undefined

  const patch: Record<string, unknown> = {}
  if (rest.title !== undefined) patch.title = rest.title
  if (rest.valid_until !== undefined) patch.valid_until = rest.valid_until
  if (rest.notes !== undefined) patch.notes = rest.notes
  if (rest.context_markdown !== undefined) patch.context_markdown = rest.context_markdown
  if (rest.problems !== undefined) {
    patch.problems = rest.problems && rest.problems.length > 0 ? rest.problems : null
  }
  if (rest.solutions !== undefined) {
    patch.solutions = rest.solutions && rest.solutions.length > 0 ? rest.solutions : null
  }
  if (rest.terms !== undefined) patch.terms = rest.terms
  if (rest.scope_modules !== undefined) {
    patch.scope_modules =
      rest.scope_modules && rest.scope_modules.length > 0 ? rest.scope_modules : null
  }
  if (rest.deliverables !== undefined) patch.deliverables = rest.deliverables
  if (rest.acceptance_criteria !== undefined) patch.acceptance_criteria = rest.acceptance_criteria
  if (rest.payment_schedule !== undefined) patch.payment_schedule = rest.payment_schedule
  if (rest.payment_plan !== undefined) patch.payment_plan = rest.payment_plan
  if (rest.payment_terms !== undefined) patch.payment_terms = rest.payment_terms
  if (rest.change_management_terms !== undefined) {
    patch.change_management_terms = rest.change_management_terms
  }
  if (rest.legal_terms !== undefined) patch.legal_terms = rest.legal_terms
  if (rest.maintenance_options !== undefined) patch.maintenance_options = rest.maintenance_options
  if (rest.maintenance_selected_plan_id !== undefined) {
    patch.maintenance_selected_plan_id = rest.maintenance_selected_plan_id
    patch.maintenance_selection_source = rest.maintenance_selected_plan_id ? 'team' : null
    patch.maintenance_selected_at = rest.maintenance_selected_plan_id
      ? new Date().toISOString()
      : null
  }

  if (
    persistedItems &&
    rest.payment_terms === undefined &&
    current.payment_schedule === 'half_half' &&
    typeof priceFields.payment_terms === 'string' &&
    priceFields.payment_terms.includes('50 %')
  ) {
    const automaticPaymentTerms = recurringPaymentTerms(
      persistedItems,
      current.created_at as string | null,
    )
    if (automaticPaymentTerms) {
      patch.payment_schedule = 'custom'
      patch.payment_plan = []
      patch.payment_terms = automaticPaymentTerms
    }
  }

  if (persistedItems) {
    const { data, error: rpcError } = await supabase.rpc('update_proposal_items_versioned', {
      p_proposal_id: id,
      p_expected_version: expected_version,
      p_patch: patch,
      p_items: persistedItems,
    })
    if (rpcError) {
      if (rpcError.message === 'VERSION_CONFLICT') {
        return {
          ok: false,
          code: 'conflict',
          error: 'Este registro ha cambiado mientras lo editabas.',
        }
      }
      log.error({ err: rpcError, id }, 'replace_proposal_items_failed')
      return { ok: false, error: rpcError.message }
    }
    const version = Number((data as Array<{ version: number }> | null)?.[0]?.version)
    if (!Number.isSafeInteger(version))
      return { ok: false, error: 'No se pudo confirmar el guardado' }
    revalidatePath(`/proposals/${id}`)
    return { ok: true, version }
  } else if (Object.keys(patch).length > 0) {
    const { data, error: updateError } = await supabase
      .from('proposals')
      .update(patch)
      .eq('id', id)
      .eq('version', expected_version)
      .select('version')
      .maybeSingle()
    if (updateError) {
      log.error({ err: updateError, id }, 'update_proposal_failed')
      return { ok: false, error: updateError.message }
    }
    if (!data)
      return {
        ok: false,
        code: 'conflict',
        error: 'Este registro ha cambiado mientras lo editabas.',
      }
    revalidatePath(`/proposals/${id}`)
    return { ok: true, version: Number(data.version) }
  }

  return { ok: true, version: expected_version }
}

/** Replaces the people shown as the project team in the client deck. */
export async function replaceProposalTeam(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('proposals.write')

  const parsed = UpdateProposalTeamInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos no válidos' }

  const { proposal_id, member_ids } = parsed.data
  const supabase = await createServerClient()
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('status')
    .eq('id', proposal_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (proposalError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (!isProposalEditable(proposal.status)) {
    return { ok: false, error: 'La propuesta ya ha sido respondida y no se puede editar' }
  }

  if (member_ids.length > 0) {
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id')
      .in('id', member_ids)
      .is('deleted_at', null)
    if (membersError || members?.length !== member_ids.length) {
      return { ok: false, error: 'Hay personas seleccionadas que ya no están disponibles' }
    }
  }

  const { error: deleteError } = await supabase
    .from('proposal_team_members')
    .delete()
    .eq('proposal_id', proposal_id)
  if (deleteError) return { ok: false, error: deleteError.message }

  if (member_ids.length > 0) {
    const { error: insertError } = await supabase
      .from('proposal_team_members')
      .insert(member_ids.map((member_id, position) => ({ proposal_id, member_id, position })))
    if (insertError) return { ok: false, error: insertError.message }
  }

  revalidatePath(`/proposals/${proposal_id}`)
  return { ok: true }
}

const EditorInput = UpdateProposalInput.extend({
  team_member_ids: UpdateProposalTeamInput.shape.member_ids,
})

export type EditorSaveResult =
  | { ok: true; version: number }
  | { ok: false; error: string; code?: 'conflict'; version?: number }

/** Keep the existing versioned proposal write and team write behind one use case.
 * A team failure returns the persisted version so the draft can be retried safely.
 */
export async function saveProposalEditorDraft(input: unknown): Promise<EditorSaveResult> {
  await requirePermission('proposals.write')
  // Validate the complete intent before either write, including team member IDs.
  const parsed = EditorInput.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      error:
        formatProposalValidationIssues(parsed.error.issues).join('\n') ||
        'Datos de la propuesta no válidos',
    }
  const { team_member_ids, ...proposal } = parsed.data
  const result = await updateProposalRecord(proposal)
  if (!result.ok) return result
  try {
    const teamResult = await replaceProposalTeam({
      proposal_id: proposal.id,
      member_ids: team_member_ids,
    })
    if (teamResult.ok) return result
    return {
      ok: false,
      version: result.version,
      error: `La propuesta se guardó, pero no se pudo actualizar el equipo: ${teamResult.error}`,
    }
  } catch (error) {
    log.error({ err: error, id: proposal.id }, 'save_proposal_team_failed')
    return {
      ok: false,
      version: result.version,
      error: 'La propuesta se guardó, pero no se pudo actualizar el equipo. Vuelve a intentarlo.',
    }
  }
}
