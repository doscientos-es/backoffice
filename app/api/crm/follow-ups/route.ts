/**
 * GET /api/crm/follow-ups
 *
 * Cron endpoint consumed by n8n / Vercel Cron. Returns stale leads, pending
 * proposals, and speed-to-lead SLA breaches. It sends PWA notifications for
 * actionable follow-up summaries.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * The endpoint fails closed when CRON_SECRET is not configured.
 */

import { type NextRequest, NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { getFollowUps } from '@/lib/integrations/follow-ups'
import { scopedLogger } from '@/lib/logger'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import {
  buildLeadFollowUpLink,
  collectLeadFollowUpSummaries,
  formatLeadFollowUpSummary,
  shouldSendLeadFollowUpSummary,
} from '@/lib/notifications/lead-follow-up-summary'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('crm.follow-ups')
const SUMMARY_EVENT_TYPE = 'lead_follow_up_summary'

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET])) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const slaHours = Number(url.searchParams.get('sla_hours') ?? '4')
  const leadHours = Number(url.searchParams.get('lead_hours') ?? '24')
  const proposalHours = Number(url.searchParams.get('proposal_hours') ?? '72')

  const data = await getFollowUps({ slaHours, leadHours, proposalHours })

  try {
    await dispatchLeadFollowUpNotifications(data)
  } catch (error) {
    log.error({ err: error }, 'lead follow-up notifications failed')
  }

  log.info(
    {
      uncontacted: data.counts.uncontactedLeads,
      stale: data.counts.staleLeads,
      proposals: data.counts.pendingProposals,
    },
    'follow-ups cron executed',
  )

  return NextResponse.json(data)
}

async function dispatchLeadFollowUpNotifications(data: Awaited<ReturnType<typeof getFollowUps>>) {
  const supabase = createAdminClient()
  const { data: admins, error: adminsError } = await supabase
    .from('team_members')
    .select('id')
    .in('role', ['owner', 'admin'])
    .is('deleted_at', null)
  if (adminsError) throw new Error(adminsError.message)
  const adminIds = (admins ?? []).map((member) => member.id as string)
  const summaries = collectLeadFollowUpSummaries(data, adminIds)
  if (!summaries.length) return

  const recipientIds = summaries.map((summary) => summary.recipientId)
  const { data: recentNotifications, error: recentError } = await supabase
    .from('notifications')
    .select('recipient_id, body')
    .eq('event_type', SUMMARY_EVENT_TYPE)
    .in('recipient_id', recipientIds)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
  if (recentError) throw new Error(recentError.message)
  const previousBodies = new Map<string, string | null>()
  for (const notification of recentNotifications ?? []) {
    if (!previousBodies.has(notification.recipient_id)) {
      previousBodies.set(notification.recipient_id, notification.body)
    }
  }

  for (const summary of summaries) {
    const previousBody = previousBodies.has(summary.recipientId)
      ? previousBodies.get(summary.recipientId)
      : undefined
    if (!shouldSendLeadFollowUpSummary(summary, previousBody)) continue
    await dispatchNotifications({
      recipientIds: [summary.recipientId],
      eventType: SUMMARY_EVENT_TYPE,
      entityType: 'lead_follow_up_summary',
      entityId: summary.recipientId,
      body: formatLeadFollowUpSummary(summary),
      link: buildLeadFollowUpLink(summary),
    })
  }
}
