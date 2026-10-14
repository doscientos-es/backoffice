import { isActiveLeadStatus } from '@/lib/leads/pipeline'

export type PerformanceLead = {
  id: string
  created_at: string
  first_contacted_at: string | null
  assigned_to: string | null
  status: string
}
export type PerformanceProposal = {
  id: string
  lead_id: string | null
  created_by: string | null
  status: string
  created_at: string
  sent_at: string | null
  viewed_at: string | null
  responded_at: string | null
  delivered_at: string | null
  total: number | null
}
export type PerformanceInteraction = {
  id: string
  lead_id: string | null
  performed_by: string | null
  type: string
  created_at: string
  payload: unknown
}
export type PerformanceReminder = {
  lead_id: string | null
  start_at: string | null
}
export type DurationSummary = {
  count: number
  missing: number
  invalid: number
  meanHours: number | null
  medianHours: number | null
  p90Hours: number | null
}
export type DurationPair = [string | null, string | null]

/** Calendar hours, not working hours. Missing dates never become zero. */
export function summarizeDurations(pairs: DurationPair[], now: Date): DurationSummary {
  const hours: number[] = []
  let missing = 0
  let invalid = 0
  for (const [start, end] of pairs) {
    if (!start || !end) {
      missing += 1
      continue
    }
    const from = Date.parse(start)
    const to = Date.parse(end)
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to > now.getTime()) {
      invalid += 1
      continue
    }
    hours.push((to - from) / 3_600_000)
  }
  hours.sort((a, b) => a - b)
  const count = hours.length
  const middle = Math.floor(count / 2)
  return {
    count,
    missing,
    invalid,
    meanHours: count ? hours.reduce((sum, value) => sum + value, 0) / count : null,
    medianHours: count
      ? count % 2
        ? hours[middle]
        : (hours[middle - 1] + hours[middle]) / 2
      : null,
    p90Hours: count ? hours[Math.ceil(count * 0.9) - 1] : null,
  }
}

export function formatDuration(hours: number | null): string {
  if (hours === null) return 'Sin datos'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`
  return `${(hours / 24).toLocaleString('es-ES', { maximumFractionDigits: 1 })} días`
}

const percent = (value: number, total: number) => (total ? (value / total) * 100 : null)
const unique = <T extends { id: string }>(rows: T[]): T[] => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
]
const inWindow = (value: string, start: number, end: number) => {
  const time = Date.parse(value)
  return time >= start && time <= end
}
const target = (payload: unknown) =>
  payload && typeof payload === 'object' && 'to' in payload ? (payload as { to: unknown }).to : null

export function buildCommercialPerformance(input: {
  leads: PerformanceLead[]
  proposals: PerformanceProposal[]
  interactions: PerformanceInteraction[]
  reminders: PerformanceReminder[]
  members: { id: string; name: string }[]
  since: string
  until: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const start = Date.parse(`${input.since}T00:00:00.000Z`)
  const end = Math.min(Date.parse(`${input.until}T23:59:59.999Z`), now.getTime())
  const leads = unique(input.leads).filter((row) => inWindow(row.created_at, start, end))
  const allProposals = unique(input.proposals)
  const proposals = allProposals.filter((row) => inWindow(row.created_at, start, end))
  const interactions = unique(input.interactions)
  const activity = interactions.filter((row) => inWindow(row.created_at, start, end))
  const sent = proposals.filter((row) => row.sent_at && Date.parse(row.sent_at) <= now.getTime())
  const accepted = proposals.filter((row) => row.status === 'accepted')
  const rejected = proposals.filter((row) => row.status === 'rejected')
  const pending = proposals.filter((row) => ['sent', 'viewed'].includes(row.status))
  const drafts = proposals.filter((row) => row.status === 'draft')
  const active = leads.filter((row) =>
    isActiveLeadStatus(row.status as Parameters<typeof isActiveLeadStatus>[0]),
  )
  const scheduled = new Set(
    input.reminders
      .filter((row) => row.start_at && Date.parse(row.start_at) >= now.getTime())
      .map((row) => row.lead_id),
  )
  const covered = active.filter((row) => scheduled.has(row.id))
  const firstSentByLead = new Map<string, string>()
  for (const proposal of allProposals) {
    if (!proposal.lead_id || !proposal.sent_at || !Number.isFinite(Date.parse(proposal.sent_at)))
      continue
    const previous = firstSentByLead.get(proposal.lead_id)
    if (!previous || Date.parse(proposal.sent_at) < Date.parse(previous))
      firstSentByLead.set(proposal.lead_id, proposal.sent_at)
  }
  const firstWonByLead = new Map<string, string>()
  for (const event of interactions) {
    if (event.type !== 'status_change' || target(event.payload) !== 'won' || !event.lead_id)
      continue
    const previous = firstWonByLead.get(event.lead_id)
    if (!previous || Date.parse(event.created_at) < Date.parse(previous))
      firstWonByLead.set(event.lead_id, event.created_at)
  }
  const timing = {
    firstContact: summarizeDurations(
      leads.map((row) => [row.created_at, row.first_contacted_at]),
      now,
    ),
    leadToProposal: summarizeDurations(
      leads.map((row) => [row.created_at, firstSentByLead.get(row.id) ?? null]),
      now,
    ),
    preparation: summarizeDurations(
      sent.map((row) => [row.created_at, row.sent_at]),
      now,
    ),
    firstView: summarizeDurations(
      sent.map((row) => [row.sent_at, row.viewed_at]),
      now,
    ),
    acceptance: summarizeDurations(
      accepted.map((row) => [row.sent_at, row.responded_at]),
      now,
    ),
    rejection: summarizeDurations(
      rejected.map((row) => [row.sent_at, row.responded_at]),
      now,
    ),
    leadToWin: summarizeDurations(
      leads
        .filter((row) => row.status === 'won')
        .map((row) => [row.created_at, firstWonByLead.get(row.id) ?? null]),
      now,
    ),
    delivery: summarizeDurations(
      accepted.map((row) => [row.responded_at, row.delivered_at]),
      now,
    ),
    pendingAge: summarizeDurations(
      pending.map((row) => [row.sent_at, now.toISOString()]),
      now,
    ),
    draftAge: summarizeDurations(
      drafts.map((row) => [row.created_at, now.toISOString()]),
      now,
    ),
  }
  const amount = (rows: PerformanceProposal[]) =>
    rows.some((row) => row.total !== null)
      ? rows.reduce((sum, row) => sum + (row.total ?? 0), 0)
      : null
  const names = new Map(input.members.map((row) => [row.id, row.name]))
  const memberIds = new Set([
    ...leads.map((row) => row.assigned_to),
    ...proposals.map((row) => row.created_by),
    ...activity
      .filter((row) => ['call', 'email_sent', 'meeting'].includes(row.type))
      .map((row) => row.performed_by),
  ])
  const byMember = [...memberIds]
    .map((id) => {
      const owned = leads.filter((row) => row.assigned_to === id)
      const authored = proposals.filter((row) => row.created_by === id)
      const won = owned.filter((row) => row.status === 'won').length
      const closedProposals = authored.filter((row) => row.status === 'accepted')
      const touches = activity.filter((row) => row.performed_by === id)
      const open = owned.filter((row) =>
        isActiveLeadStatus(row.status as Parameters<typeof isActiveLeadStatus>[0]),
      )
      const sentProposals = authored.filter(
        (row) => row.sent_at && Date.parse(row.sent_at) <= now.getTime(),
      )
      return {
        id,
        name: id ? (names.get(id) ?? 'Miembro no disponible') : 'Sin responsable / sistema',
        leads: owned.length,
        won,
        conversionRate: percent(won, owned.length),
        sent: sentProposals.length,
        accepted: closedProposals.length,
        acceptedValue: amount(closedProposals),
        calls: touches.filter((row) => row.type === 'call').length,
        emails: touches.filter((row) => row.type === 'email_sent').length,
        meetings: touches.filter((row) => row.type === 'meeting').length,
        active: open.length,
        covered: open.filter((row) => scheduled.has(row.id)).length,
        firstContact: summarizeDurations(
          owned.map((row) => [row.created_at, row.first_contacted_at]),
          now,
        ),
        preparation: summarizeDurations(
          sentProposals.map((row) => [row.created_at, row.sent_at]),
          now,
        ),
        acceptance: summarizeDurations(
          closedProposals.map((row) => [row.sent_at, row.responded_at]),
          now,
        ),
      }
    })
    .sort((a, b) => b.accepted - a.accepted || b.won - a.won || a.name.localeCompare(b.name, 'es'))
  const acceptedSent = sent.filter((row) => row.status === 'accepted').length
  const rejectedSent = sent.filter((row) => row.status === 'rejected').length
  return {
    leadCount: leads.length,
    proposalCount: proposals.length,
    sent: sent.length,
    accepted: accepted.length,
    rejected: rejected.length,
    pending: pending.length,
    drafts: drafts.length,
    viewed: sent.filter((row) => row.viewed_at).length,
    viewRate: percent(sent.filter((row) => row.viewed_at).length, sent.length),
    acceptanceRate: percent(acceptedSent, sent.length),
    decidedAcceptanceRate: percent(acceptedSent, acceptedSent + rejectedSent),
    acceptedValue: amount(accepted),
    pendingValue: amount(pending),
    averageAcceptedValue:
      accepted.length && amount(accepted) !== null ? amount(accepted)! / accepted.length : null,
    manualAcceptances: accepted.filter((row) => !row.sent_at).length,
    active: active.length,
    covered: covered.length,
    withoutNextStep: active.length - covered.length,
    coverageRate: percent(covered.length, active.length),
    waiting72h: pending.filter(
      (row) => row.sent_at && now.getTime() - Date.parse(row.sent_at) >= 72 * 3_600_000,
    ).length,
    calls: activity.filter((row) => row.type === 'call').length,
    emails: activity.filter((row) => row.type === 'email_sent').length,
    replies: activity.filter((row) => row.type === 'email_received').length,
    meetings: activity.filter((row) => row.type === 'meeting').length,
    timing,
    byMember,
  }
}

export type CommercialPerformance = ReturnType<typeof buildCommercialPerformance>
