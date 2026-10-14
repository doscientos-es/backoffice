import 'server-only'
import { requirePagePermission } from '@/lib/auth'
import {
  buildCommercialPerformance,
  type PerformanceInteraction,
  type PerformanceLead,
  type PerformanceProposal,
  type PerformanceReminder,
} from '@/lib/leads/commercial-performance'
import { scopedLogger } from '@/lib/logger'
import { can } from '@/lib/permissions'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('leads.commercial-performance')
const PAGE_SIZE = 500

/** Explicit pagination avoids silently turning the API row cap into statistics. */
export async function readPerformancePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error('No se pudieron leer todos los datos del informe comercial.')
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function batches(ids: string[]) {
  return Array.from({ length: Math.ceil(ids.length / 200) }, (_, index) =>
    ids.slice(index * 200, (index + 1) * 200),
  )
}

export async function getCommercialPerformance(input: { since: string; until: string }) {
  const user = await requirePagePermission('leads.read')
  const canSeePrices = can(user.role, 'proposals.prices')
  const supabase = await createServerClient()
  const start = `${input.since}T00:00:00.000Z`
  const end = `${input.until}T23:59:59.999Z`
  const proposalColumns =
    'id, lead_id, client_id, created_by, status, created_at, sent_at, viewed_at, responded_at, delivered_at, clients(lead_id)'
  type ProposalRow = Omit<PerformanceProposal, 'total'> & {
    client_id: string | null
    clients: { lead_id: string | null } | null
  }
  try {
    const [leads, cohortProposals, activity, members] = await Promise.all([
      readPerformancePages<PerformanceLead>((from, to) =>
        supabase
          .from('leads')
          .select('id, status, created_at, first_contacted_at, assigned_to')
          .is('deleted_at', null)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('id')
          .range(from, to),
      ),
      readPerformancePages<ProposalRow>((from, to) =>
        supabase
          .from('proposals')
          .select(proposalColumns)
          .is('deleted_at', null)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('id')
          .range(from, to),
      ),
      readPerformancePages<PerformanceInteraction>((from, to) =>
        supabase
          .from('lead_interactions')
          .select('id, lead_id, performed_by, type, created_at, payload, leads!inner(deleted_at)')
          .is('leads.deleted_at', null)
          .gte('created_at', start)
          .lte('created_at', end)
          .in('type', ['call', 'email_sent', 'email_received', 'meeting'])
          .order('id')
          .range(from, to),
      ),
      readPerformancePages<{ id: string; name: string }>((from, to) =>
        supabase
          .from('team_members')
          .select('id, name')
          .is('deleted_at', null)
          .order('id')
          .range(from, to),
      ),
    ])
    const leadBatches = batches(leads.map((row) => row.id))
    const relatedProposals: ProposalRow[] = []
    const history: PerformanceInteraction[] = []
    const reminders: PerformanceReminder[] = []
    // Batch dependent reads to keep URLs bounded, retaining the full lifetime
    // of cohort leads even when a proposal was sent after the selected window.
    for (const ids of leadBatches) {
      const [direct, clients, events, pendingReminders] = await Promise.all([
        readPerformancePages<ProposalRow>((from, to) =>
          supabase
            .from('proposals')
            .select(proposalColumns)
            .is('deleted_at', null)
            .in('lead_id', ids)
            .order('id')
            .range(from, to),
        ),
        readPerformancePages<{ id: string }>((from, to) =>
          supabase
            .from('clients')
            .select('id')
            .is('deleted_at', null)
            .in('lead_id', ids)
            .order('id')
            .range(from, to),
        ),
        readPerformancePages<PerformanceInteraction>((from, to) =>
          supabase
            .from('lead_interactions')
            .select('id, lead_id, performed_by, type, created_at, payload')
            .in('lead_id', ids)
            .eq('type', 'status_change')
            .order('id')
            .range(from, to),
        ),
        readPerformancePages<PerformanceReminder>((from, to) =>
          supabase
            .from('tasks')
            .select('lead_id, start_at')
            .is('deleted_at', null)
            .is('completed_at', null)
            .eq('kind', 'reminder')
            .in('status', ['todo', 'in_progress'])
            .in('lead_id', ids)
            .order('id')
            .range(from, to),
        ),
      ])
      relatedProposals.push(...direct)
      history.push(...events)
      reminders.push(...pendingReminders)
      for (const clientIds of batches(clients.map((row) => row.id))) {
        relatedProposals.push(
          ...(await readPerformancePages<ProposalRow>((from, to) =>
            supabase
              .from('proposals')
              .select(proposalColumns)
              .is('deleted_at', null)
              .in('client_id', clientIds)
              .order('id')
              .range(from, to),
          )),
        )
      }
    }
    const proposalRows = [
      ...new Map([...cohortProposals, ...relatedProposals].map((row) => [row.id, row])).values(),
    ]
    const prices = new Map<string, number>()
    // Prices are read only through the permission-aware projection, never by
    // selecting total from proposals or by bypassing RLS with an admin client.
    if (canSeePrices) {
      for (const ids of batches(cohortProposals.map((row) => row.id))) {
        const rows = await readPerformancePages<{ proposal_id: string; total: number }>(
          (from, to) =>
            supabase
              .from('proposal_prices')
              .select('proposal_id, total')
              .in('proposal_id', ids)
              .order('proposal_id')
              .range(from, to),
        )
        for (const row of rows) {
          const value = Number(row.total)
          if (Number.isFinite(value)) prices.set(row.proposal_id, value)
        }
      }
    }
    const proposals = proposalRows.map((row) => ({
      ...row,
      lead_id: row.lead_id ?? row.clients?.lead_id ?? null,
      total: prices.get(row.id) ?? null,
    }))
    return {
      performance: buildCommercialPerformance({
        ...input,
        leads,
        proposals,
        interactions: [...activity, ...history],
        reminders,
        members,
      }),
      canSeePrices,
      error: null,
    }
  } catch {
    log.error('commercial performance query failed')
    return {
      performance: null,
      canSeePrices,
      error: 'No se pudieron cargar las estadísticas comerciales completas. Reintenta más tarde.',
    }
  }
}
