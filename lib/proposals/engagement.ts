import { scopedLogger } from '@/lib/logger'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

import { resolveLeadId, resolveRecipientId, type ViewedProposal } from './record-client-view'

const log = scopedLogger('proposals.engagement')

/** Interest signals a lead can show on the public proposal, with their weight. */
export const ENGAGEMENT_POINTS = {
  return_visit: 8,
  pricing_viewed: 5,
  terms_viewed: 4,
  pdf_download: 6,
  deck_completed: 10,
  whatsapp_click: 8,
  question_sent: 12,
  maintenance_selected: 10,
  sign_form_opened: 15,
} as const

export type EngagementType = keyof typeof ENGAGEMENT_POINTS

/** Signals the browser may report itself; the rest are only written by the server. */
export const CLIENT_REPORTABLE_ENGAGEMENT = [
  'pricing_viewed',
  'terms_viewed',
  'whatsapp_click',
] as const satisfies readonly EngagementType[]

const HOUR = 60 * 60 * 1000

/** Repeats inside the window add nothing (null = every occurrence counts). */
const DEDUPE_WINDOW_MS: Record<EngagementType, number | null> = {
  return_visit: 6 * HOUR,
  pricing_viewed: 24 * HOUR,
  terms_viewed: 24 * HOUR,
  pdf_download: 24 * HOUR,
  deck_completed: 24 * HOUR * 365,
  whatsapp_click: 24 * HOUR,
  question_sent: null,
  maintenance_selected: 24 * HOUR,
  sign_form_opened: 24 * HOUR,
}

/** Only the last two weeks count: interest cools down if the lead goes quiet. */
const SCORE_WINDOW_MS = 14 * 24 * HOUR
const HOT_AT = 40
const WARM_AT = 20
const CLOSED_STATUSES = ['won', 'lost', 'not_interested', 'archived']

type Temperature = 'hot' | 'warm' | 'cold'
const RANK: Record<Temperature, number> = { cold: 0, warm: 1, hot: 2 }

export function temperatureForScore(score: number): Temperature | null {
  if (score >= HOT_AT) return 'hot'
  if (score >= WARM_AT) return 'warm'
  return null
}

/**
 * Stores one interest signal and refreshes the lead: engagement score, last
 * activity and — only upwards — its temperature. Best-effort: it never throws,
 * because tracking must not break the public page.
 */
export async function recordProposalEngagement(
  proposal: ViewedProposal,
  type: EngagementType,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const leadId = await resolveLeadId(admin, proposal)
    if (!leadId) return

    const window = DEDUPE_WINDOW_MS[type]
    if (window !== null) {
      const { count } = await admin
        .from('proposal_engagement_events')
        .select('id', { count: 'exact', head: true })
        .eq('proposal_id', proposal.id)
        .eq('event_type', type)
        .gte('created_at', new Date(Date.now() - window).toISOString())
      if ((count ?? 0) > 0) return
    }

    const { error } = await admin.from('proposal_engagement_events').insert({
      proposal_id: proposal.id,
      lead_id: leadId,
      event_type: type,
      points: ENGAGEMENT_POINTS[type],
      payload: payload ?? null,
    })
    if (error) {
      log.warn({ err: error, proposalId: proposal.id, type }, 'engagement_insert_failed')
      return
    }
    await refreshLeadHeat(admin, proposal, leadId)
  } catch (err) {
    log.warn({ err, proposalId: proposal.id, type }, 'engagement_record_failed')
  }
}

async function refreshLeadHeat(
  admin: ReturnType<typeof createAdminClient>,
  proposal: ViewedProposal,
  leadId: string,
): Promise<void> {
  const since = new Date(Date.now() - SCORE_WINDOW_MS).toISOString()
  const [{ data: events }, { data: lead }] = await Promise.all([
    admin
      .from('proposal_engagement_events')
      .select('points')
      .eq('lead_id', leadId)
      .gte('created_at', since),
    admin
      .from('leads')
      .select('name, status, temperature')
      .eq('id', leadId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  if (!lead) return

  const score = Math.min(
    100,
    (events ?? []).reduce((sum, row) => sum + Number(row.points ?? 0), 0),
  )
  const current = (lead.temperature as Temperature | null) ?? null
  const target = temperatureForScore(score)
  const open = !CLOSED_STATUSES.includes(lead.status as string)
  const upgrade =
    open && target !== null && (current === null || RANK[target] > RANK[current]) ? target : null

  const { error } = await admin
    .from('leads')
    .update({
      engagement_score: score,
      last_engaged_at: new Date().toISOString(),
      ...(upgrade ? { temperature: upgrade } : {}),
    })
    .eq('id', leadId)
  if (error) {
    log.warn({ err: error, leadId }, 'engagement_lead_update_failed')
    return
  }
  if (!upgrade) return

  await admin.from('lead_interactions').insert({
    lead_id: leadId,
    client_id: proposal.client_id,
    type: 'note',
    subject: `Lead más caliente: ${current ?? 'sin temperatura'} → ${upgrade}`,
    body: `Por su interés en la propuesta ${proposal.number ?? ''} (${score} puntos en los últimos 14 días).`,
    payload: {
      source: 'proposal_engagement',
      proposal_id: proposal.id,
      score,
      from: current,
      to: upgrade,
    },
  })

  if (upgrade !== 'hot') return
  const recipientId = await resolveRecipientId(admin, proposal, leadId)
  if (!recipientId) return
  await dispatchNotifications({
    recipientIds: [recipientId],
    eventType: 'proposal_viewed',
    entityType: 'proposal',
    entityId: proposal.id,
    body: `🔥 ${lead.name as string} se ha calentado: mucho interés en ${proposal.number ?? 'la propuesta'}. Escríbele ya`,
    link: `/leads/${leadId}`,
  })
}
