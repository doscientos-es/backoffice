import { scopedLogger } from '@/lib/logger'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('proposals.client-view')

export type ProposalViewSurface = 'portal' | 'deck'

type ViewedProposal = {
  id: string
  number: string | null
  title: string | null
  lead_id: string | null
  client_id: string | null
  created_by: string | null
}

const SURFACE_LABEL: Record<ProposalViewSurface, string> = {
  portal: 'el presupuesto',
  deck: 'la presentación',
}

/**
 * Inserts a page-level open into proposal_view_events. External (client) opens
 * are skipped when one for the same proposal and surface was already recorded
 * in the last minute (double loads, prefetches, link scanners). Returns whether
 * a row was inserted.
 */
export async function insertPageViewEvent(event: {
  proposalId: string
  viewerType: 'client' | 'team'
  teamMemberId: string | null
  surface: ProposalViewSurface
  ip: string | null
  userAgent: string | null
}): Promise<boolean> {
  const admin = createAdminClient()

  if (event.viewerType === 'client') {
    const since = new Date(Date.now() - 60_000).toISOString()
    const { count, error } = await admin
      .from('proposal_view_events')
      .select('id', { count: 'exact', head: true })
      .eq('proposal_id', event.proposalId)
      .eq('viewer_type', 'client')
      .eq('surface', event.surface)
      .is('session_id', null)
      .gte('viewed_at', since)
    if (error) log.warn({ err: error, proposalId: event.proposalId }, 'proposal_view_dedupe_failed')
    else if ((count ?? 0) > 0) return false
  }

  const { error } = await admin.from('proposal_view_events').insert({
    proposal_id: event.proposalId,
    viewer_type: event.viewerType,
    team_member_id: event.teamMemberId,
    surface: event.surface,
    ip: event.ip,
    user_agent: event.userAgent,
  })
  if (error) {
    log.warn({ err: error, proposalId: event.proposalId }, 'proposal_view_insert_failed')
    return false
  }
  return true
}

/**
 * First external open of a proposal. Reloads stay in proposal_view_events;
 * the team is notified once and the lead history gets a single portal_view.
 * Best-effort: a tracking failure must not block the public page.
 */
export async function recordClientProposalView(
  proposal: ViewedProposal,
  surface: ProposalViewSurface,
): Promise<void> {
  const admin = createAdminClient()
  const proposalId = proposal.id

  const { count, error: countError } = await admin
    .from('proposal_view_events')
    .select('id', { count: 'exact', head: true })
    .eq('proposal_id', proposalId)
    .eq('viewer_type', 'client')
    .eq('surface', surface)
    .is('session_id', null)

  // The page inserts the current visit before calling this. One row means first open.
  if (countError || count !== 1) {
    if (countError) log.warn({ err: countError, proposalId }, 'proposal_view_count_failed')
    return
  }

  const leadId = await resolveLeadId(admin, proposal)
  const label = proposal.number ?? proposal.title ?? 'Propuesta'
  const subject = `Ha abierto ${SURFACE_LABEL[surface]} · ${label}`

  if (leadId) {
    const { error } = await admin.from('lead_interactions').insert({
      lead_id: leadId,
      client_id: proposal.client_id,
      type: 'portal_view',
      subject,
      payload: { proposal_id: proposalId, surface },
    })
    if (error) log.warn({ err: error, proposalId, leadId }, 'proposal_view_interaction_failed')
  }

  const recipientId = await resolveRecipientId(admin, proposal, leadId)
  if (!recipientId) return

  await dispatchNotifications({
    recipientIds: [recipientId],
    eventType: 'proposal_viewed',
    entityType: 'proposal',
    entityId: proposalId,
    body: subject,
    link: leadId ? `/leads/${leadId}` : `/proposals/${proposalId}`,
  })
}

async function resolveLeadId(
  admin: ReturnType<typeof createAdminClient>,
  proposal: ViewedProposal,
): Promise<string | null> {
  if (proposal.lead_id) return proposal.lead_id
  if (!proposal.client_id) return null

  const { data, error } = await admin
    .from('clients')
    .select('lead_id')
    .eq('id', proposal.client_id)
    .maybeSingle()
  if (error) {
    log.warn({ err: error, proposalId: proposal.id }, 'proposal_view_lead_lookup_failed')
    return null
  }
  return (data?.lead_id as string | null) ?? null
}

async function resolveRecipientId(
  admin: ReturnType<typeof createAdminClient>,
  proposal: ViewedProposal,
  leadId: string | null,
): Promise<string | null> {
  if (!leadId) return proposal.created_by

  const { data, error } = await admin
    .from('leads')
    .select('assigned_to')
    .eq('id', leadId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    log.warn({ err: error, leadId }, 'proposal_view_assignee_lookup_failed')
    return proposal.created_by
  }
  return (data?.assigned_to as string | null) ?? proposal.created_by
}
