import type { SupabaseClient } from '@supabase/supabase-js'

/** Opens closer than this count as one visit, so reloads don't inflate the counter. */
const VISIT_GAP_MS = 30 * 60 * 1000
const HOUR_MS = 3_600_000

export type ProposalViewStats = { visits: number; lastViewAt: string | null }
export type ProposalHeat = 'none' | 'warm' | 'hot'

/** Groups client opens (newest first or any order) into visits separated by at least 30 minutes. */
export function summarizeViews(viewedAt: string[]): ProposalViewStats {
  const times = viewedAt.map((value) => Date.parse(value)).filter(Number.isFinite)
  times.sort((a, b) => a - b)
  let visits = 0
  let previous = Number.NEGATIVE_INFINITY
  for (const time of times) {
    if (time - previous >= VISIT_GAP_MS) visits += 1
    previous = time
  }
  const last = times.at(-1)
  return {
    visits,
    lastViewAt: last === undefined ? null : new Date(last).toISOString(),
  }
}

/**
 * How urgently to call: many visits, or a few very recent ones. A signal to follow up,
 * never proof of buying intent.
 */
export function proposalHeat(stats: ProposalViewStats, now = new Date()): ProposalHeat {
  if (stats.visits === 0) return 'none'
  const sinceLast = stats.lastViewAt ? now.getTime() - Date.parse(stats.lastViewAt) : Infinity
  if (stats.visits >= 5 || (stats.visits >= 3 && sinceLast <= 48 * HOUR_MS)) return 'hot'
  if (stats.visits >= 2) return 'warm'
  return 'none'
}

/** Client page opens per proposal (team previews and slide-level events are excluded). */
export async function getProposalViewStats(
  supabase: SupabaseClient,
  proposalIds: string[],
): Promise<Map<string, ProposalViewStats>> {
  const stats = new Map<string, ProposalViewStats>()
  if (proposalIds.length === 0) return stats
  const { data } = await supabase
    .from('proposal_view_events')
    .select('proposal_id, viewed_at')
    .in('proposal_id', proposalIds)
    .eq('viewer_type', 'client')
    .is('session_id', null)
    .limit(5000)
  const byProposal = new Map<string, string[]>()
  for (const row of (data ?? []) as {
    proposal_id: string
    viewed_at: string
  }[]) {
    const list = byProposal.get(row.proposal_id) ?? []
    list.push(row.viewed_at)
    byProposal.set(row.proposal_id, list)
  }
  for (const [id, times] of byProposal) stats.set(id, summarizeViews(times))
  return stats
}
