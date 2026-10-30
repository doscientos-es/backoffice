import { headers } from 'next/headers'
import { after } from 'next/server'

import { scopedLogger } from '@/lib/logger'
import { recordProposalEngagement } from '@/lib/proposals/engagement'
import { insertPageViewEvent, recordClientProposalView } from '@/lib/proposals/record-client-view'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('portal.proposal')

type TrackedRow = Record<string, unknown> & { id: unknown }

/**
 * View tracking is best-effort, so it runs after the response is sent instead of
 * blocking the render. Callers must skip draft previews. Request headers are read
 * here because they are not available inside `after`.
 */
export async function trackProposalView({
  proposal,
  isTeam,
  teamMemberId,
}: {
  proposal: TrackedRow
  isTeam: boolean
  teamMemberId: string | null
}) {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : (h.get('x-real-ip') ?? null)
  const userAgent = h.get('user-agent')
  const admin = createAdminClient()
  const tracked = {
    id: proposal.id as string,
    number: (proposal.number as string | null) ?? null,
    title: (proposal.title as string | null) ?? null,
    lead_id: (proposal.lead_id as string | null) ?? null,
    client_id: (proposal.client_id as string | null) ?? null,
    created_by: (proposal.created_by as string | null) ?? null,
  }
  const firstClientView = !isTeam && proposal.status === 'sent'

  after(async () => {
    try {
      // Bump 'sent' -> 'viewed' only on the first external (client) view.
      // Team previews and drafts never transition the status.
      if (firstClientView) {
        await admin
          .from('proposals')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', tracked.id)
          .eq('status', 'sent')
      }
      const inserted = await insertPageViewEvent({
        proposalId: tracked.id,
        viewerType: isTeam ? 'team' : 'client',
        teamMemberId,
        surface: 'portal',
        ip: ip ?? null,
        userAgent,
      })
      if (!isTeam && inserted) {
        const visit = await recordClientProposalView(tracked, 'portal')
        // Coming back after hours is a buying signal: heat up the lead.
        if (visit === 'return') await recordProposalEngagement(tracked, 'return_visit')
      }
    } catch (err) {
      log.warn({ err, proposalId: tracked.id }, 'proposal_view_insert_failed')
    }
  })
}
