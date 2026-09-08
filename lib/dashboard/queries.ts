import { serverEnv } from '@/lib/env'
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory, profitMargin } from '@/lib/finance/helpers'
import { ACTIVE_LEAD_STATUSES } from '@/lib/leads/pipeline'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'
import { shortMonthEs, toIsoDate } from '@/lib/utils/date'

import type {
  AccountsReceivable,
  ActionLeadRow,
  AvisosData,
  CompanyGoals,
  DashboardKpis,
  DateRange,
  GoalMetric,
  MonthFinanceSummary,
  MyDayData,
  MyTaskRow,
  OverdueInvoiceRow,
  ReminderRow,
  RevenuePoint,
} from './types'

const AVISOS_LIMIT = 5
const MY_DAY_LIMIT = 6

/** Task statuses that are still actionable (not done / cancelled). */
const OPEN_TASK_STATUSES = ['todo', 'in_progress', 'in_review'] as const

/** A null assignee intentionally represents the whole team's queue. */
export type MyDayScope = { assigneeId: string | null }

type ClientNameJoin = { clients: { name: string } | null }

type LeadActionRecord = {
  id: string
  name: string
  alias: string | null
  company: string | null
  phone: string | null
  email: string | null
  status: ActionLeadRow['status']
}

function toActionLead(row: Record<string, unknown>, sinceField: string): ActionLeadRow {
  const r = row as unknown as LeadActionRecord
  return {
    id: r.id,
    name: r.name,
    alias: r.alias ?? null,
    company: r.company ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    status: r.status,
    since: (row[sinceField] as string) ?? new Date().toISOString(),
    assigneeName: refName(row.assignee as NameRef),
  }
}

type NameRef = { name: string } | { name: string }[] | null

/** Embedded to-one relations can come back as an object or a single-item array. */
function refName(ref: NameRef): string | null {
  if (!ref) return null
  return Array.isArray(ref) ? (ref[0]?.name ?? null) : ref.name
}

type LeadRef =
  | { name: string; company: string | null }
  | { name: string; company: string | null }[]
  | null

function leadRefName(ref: LeadRef): string | null {
  if (!ref) return null
  const row = Array.isArray(ref) ? ref[0] : ref
  if (!row) return null
  return row.company ? `${row.name} · ${row.company}` : row.name
}

function toMyTask(row: Record<string, unknown>): MyTaskRow {
  const kind = row.kind === 'reminder' ? 'reminder' : 'task'
  return {
    id: row.id as string,
    title: row.title as string,
    kind,
    status: row.status as MyTaskRow['status'],
    priority: row.priority as MyTaskRow['priority'],
    due_date: (row.due_date as string | null) ?? null,
    action_at: (kind === 'reminder' ? row.start_at : row.due_date) as string | null,
    contextLabel: refName(row.projects as NameRef) ?? refName(row.leads as NameRef) ?? null,
    assigneeName: refName(row.assignee as NameRef),
  }
}

export async function getDashboardKpis(range: DateRange): Promise<DashboardKpis> {
  const supabase = await createServerClient()
  const now = new Date()
  const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const prevMonthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const prevMonthEnd = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0))
  const today = toIsoDate(now)

  const [
    leadsNew,
    leadsNewPrev,
    leadsAll,
    leadsAllPrev,
    leadsWon,
    leadsWonPrev,
    proposalsOpen,
    proposalsOpenPrev,
    pipelineRes,
    overdueCount,
    monthRevenueRes,
    prevMonthRevenueRes,
  ] = await Promise.all([
    countLeads({ from: range.current.from, to: range.current.to, status: 'new' }),
    countLeads({ from: range.previous.from, to: range.previous.to, status: 'new' }),
    countLeads({ from: range.current.from, to: range.current.to }),
    countLeads({ from: range.previous.from, to: range.previous.to }),
    countLeads({ from: range.current.from, to: range.current.to, status: 'won' }),
    countLeads({ from: range.previous.from, to: range.previous.to, status: 'won' }),
    countOpenProposals(range.current),
    countOpenProposals(range.previous),
    supabase
      .from('proposals')
      .select('total')
      .in('status', ['sent', 'viewed'])
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .lt('due_date', today)
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('total')
      .gte('issue_date', monthStart)
      .in('status', ['issued', 'paid', 'overdue'])
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('total')
      .gte('issue_date', prevMonthStart)
      .lte('issue_date', prevMonthEnd)
      .in('status', ['issued', 'paid', 'overdue'])
      .is('deleted_at', null),
  ])

  const pipelineValue = (pipelineRes.data ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)
  const monthRevenue = (monthRevenueRes.data ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)
  const monthRevenuePrev = (prevMonthRevenueRes.data ?? []).reduce(
    (a, r) => a + Number(r.total ?? 0),
    0,
  )

  return {
    leadsNew,
    leadsNewPrev,
    proposalsOpen,
    proposalsOpenPrev,
    overdueCount: overdueCount.count ?? 0,
    monthRevenue,
    monthRevenuePrev,
    pipelineValue,
    conversionRate: leadsAll > 0 ? leadsWon / leadsAll : 0,
    conversionRatePrev: leadsAllPrev > 0 ? leadsWonPrev / leadsAllPrev : 0,
  }
}

async function countLeads(args: { from: Date; to: Date; status?: 'new' | 'won' }): Promise<number> {
  const supabase = await createServerClient()
  let q = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', args.from.toISOString())
    .lte('created_at', args.to.toISOString())
    .is('deleted_at', null)
  if (args.status) q = q.eq('status', args.status)
  const { count } = await q
  return count ?? 0
}

async function countOpenProposals(window: { from: Date; to: Date }): Promise<number> {
  const supabase = await createServerClient()
  const { count } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .in('status', ['sent', 'viewed'])
    .gte('created_at', window.from.toISOString())
    .lte('created_at', window.to.toISOString())
    .is('deleted_at', null)
  return count ?? 0
}

export async function getAvisos(): Promise<AvisosData> {
  const supabase = await createServerClient()
  const env = serverEnv()
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 86_400_000)
  const in30Days = new Date(now.getTime() + 30 * 86_400_000)
  const today = toIsoDate(now)

  const [remindersRes, overdueRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, start_at')
      .eq('kind', 'reminder')
      .is('completed_at', null)
      .is('deleted_at', null)
      .lte('start_at', in7Days.toISOString())
      .order('start_at', { ascending: true })
      .limit(AVISOS_LIMIT),
    supabase
      .from('invoices')
      .select('id, full_number, due_date, total, clients(name)')
      .eq('status', 'sent')
      .lt('due_date', today)
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .limit(AVISOS_LIMIT),
  ])

  const reminders: ReminderRow[] = (remindersRes.data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    remind_at: r.start_at as string,
  }))

  const overdueInvoices: OverdueInvoiceRow[] = (overdueRes.data ?? []).map((inv) => {
    const join = inv as unknown as ClientNameJoin
    return {
      id: inv.id as string,
      full_number: (inv.full_number as string | null) ?? null,
      due_date: (inv.due_date as string | null) ?? null,
      total: Number(inv.total ?? 0),
      client_name: join.clients?.name ?? null,
    }
  })

  const certExpiresAt =
    env.VERIFACTU_CERT_EXPIRES_AT && new Date(env.VERIFACTU_CERT_EXPIRES_AT) <= in30Days
      ? env.VERIFACTU_CERT_EXPIRES_AT
      : null

  return { reminders, overdueInvoices, certExpiresAt }
}

export async function getRevenueSeries(months = 6): Promise<RevenuePoint[]> {
  const supabase = await createServerClient()
  const now = new Date()
  const startCurrent = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const startPrevious = new Date(now.getFullYear() - 1, now.getMonth() - (months - 1), 1)
  const endPrevious = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0)

  const [currentRes, previousRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('issue_date, total')
      .gte('issue_date', toIsoDate(startCurrent))
      .neq('status', 'draft')
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('issue_date, total')
      .gte('issue_date', toIsoDate(startPrevious))
      .lte('issue_date', toIsoDate(endPrevious))
      .neq('status', 'draft')
      .is('deleted_at', null),
  ])

  const byMonth = new Map<string, { current: number; previous: number }>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    byMonth.set(`${d.getMonth()}`, { current: 0, previous: 0 })
  }
  for (const row of currentRes.data ?? []) {
    const d = new Date(row.issue_date as string)
    const slot = byMonth.get(`${d.getMonth()}`)
    if (slot) slot.current += Number(row.total ?? 0)
  }
  for (const row of previousRes.data ?? []) {
    const d = new Date(row.issue_date as string)
    const slot = byMonth.get(`${d.getMonth()}`)
    if (slot) slot.previous += Number(row.total ?? 0)
  }

  return Array.from(byMonth.entries()).map(([key, { current, previous }]) => ({
    month: shortMonthEs(Number(key)),
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
  }))
}

/**
 * Snapshot of Accounts Receivable used by the dashboard A/R tile. We sum
 * `issued` + `overdue` totals to get what is still pending collection, with a
 * dedicated breakdown of the overdue subset, plus how much has already been
 * collected within the current calendar month.
 */
export async function getAccountsReceivable(): Promise<AccountsReceivable> {
  const supabase = await createServerClient()
  const now = new Date()
  const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1))

  const [issuedRes, overdueRes, paidMonthRes] = await Promise.all([
    notDeleted(supabase.from('invoices').select('total', { count: 'exact' })).eq(
      'status',
      'issued',
    ),
    notDeleted(supabase.from('invoices').select('total', { count: 'exact' })).eq(
      'status',
      'overdue',
    ),
    notDeleted(supabase.from('invoices').select('total', { count: 'exact' }))
      .eq('status', 'paid')
      .gte('issue_date', monthStart),
  ])

  const issuedTotal = (issuedRes.data ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)
  const overdueTotal = (overdueRes.data ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)
  const paidMonthTotal = (paidMonthRes.data ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)

  return {
    pendingTotal: issuedTotal + overdueTotal,
    pendingCount: (issuedRes.count ?? 0) + (overdueRes.count ?? 0),
    overdueTotal,
    overdueCount: overdueRes.count ?? 0,
    paidMonthTotal,
    paidMonthCount: paidMonthRes.count ?? 0,
  }
}

/**
 * Current-month revenue / expense snapshot for the dashboard expenses tile.
 * Mirrors {@link getFinanceKpis} but additionally surfaces the dominant
 * expense category so the dashboard can hint where the money is going without
 * loading the full Finance page.
 */
export async function getMonthFinanceSummary(): Promise<MonthFinanceSummary> {
  const supabase = await createServerClient()
  const now = new Date()
  const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1))

  const [{ data: revenueRows }, { data: expenseRows }] = await Promise.all([
    notDeleted(
      supabase
        .from('invoices')
        .select('total')
        .gte('issue_date', monthStart)
        .neq('status', 'draft'),
    ),
    notDeleted(
      supabase
        .from('expenses')
        .select('total, category')
        .gte('expense_date', monthStart)
        .neq('status', 'cancelled'),
    ),
  ])

  const revenueMonth = (revenueRows ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)

  const byCategory = new Map<ExpenseCategory, number>()
  let expenseMonth = 0
  for (const row of expenseRows ?? []) {
    const total = Number(row.total ?? 0)
    expenseMonth += total
    const category = row.category as ExpenseCategory
    byCategory.set(category, (byCategory.get(category) ?? 0) + total)
  }

  let topCategory: MonthFinanceSummary['topCategory'] = null
  for (const [category, total] of byCategory) {
    if (!topCategory || total > topCategory.total) {
      topCategory = {
        category,
        label: EXPENSE_CATEGORY_LABELS[category] ?? category,
        total,
      }
    }
  }

  return {
    revenueMonth,
    expenseMonth,
    netMonth: revenueMonth - expenseMonth,
    margin: profitMargin(revenueMonth, expenseMonth),
    topCategory,
  }
}

// ---------------------------------------------------------------------------
// Company goals
// ---------------------------------------------------------------------------

/**
 * Fetches the current company goals keyed by metric.
 * Only metrics that have been configured appear in the result.
 */
export async function getCompanyGoals(): Promise<CompanyGoals> {
  const supabase = await createServerClient()
  const { data } = await supabase.from('company_goals').select('metric, target')
  const goals: CompanyGoals = {}
  for (const row of data ?? []) {
    goals[row.metric as GoalMetric] = Number(row.target)
  }
  return goals
}

// ---------------------------------------------------------------------------
// "Tu día"
// ---------------------------------------------------------------------------

/**
 * "Tu día": the personal action queue, or the whole team's queue when an
 * admin/owner explicitly requests it. Returns open tasks (soonest due first),
 * active owned leads (stalest first), and unassigned leads.
 */
export async function getMyDay({ assigneeId }: MyDayScope): Promise<MyDayData> {
  const supabase = await createServerClient()
  const leadFields = 'id, name, alias, company, phone, email, status'

  let tasksQuery = supabase
    .from('tasks')
    .select(
      'id, title, kind, status, priority, due_date, start_at, projects(name), leads(name), assignee:team_members!assignee_id(name)',
    )
    .in('status', [...OPEN_TASK_STATUSES])
    .is('deleted_at', null)
  let ownedLeadsQuery = supabase
    .from('leads')
    .select(`${leadFields}, updated_at, assignee:team_members!assigned_to(name)`)
    .in('status', [...ACTIVE_LEAD_STATUSES])
    .is('deleted_at', null)
    .order('updated_at', { ascending: true })

  if (assigneeId) {
    tasksQuery = tasksQuery.eq('assignee_id', assigneeId)
    ownedLeadsQuery = ownedLeadsQuery.eq('assigned_to', assigneeId)
  } else {
    ownedLeadsQuery = ownedLeadsQuery.not('assigned_to', 'is', null)
  }

  const [tasksRes, myLeadsRes, unassignedRes] = await Promise.all([
    tasksQuery.limit(MY_DAY_LIMIT * 4),
    ownedLeadsQuery.limit(MY_DAY_LIMIT),
    supabase
      .from('leads')
      .select(`${leadFields}, created_at, assignee:team_members!assigned_to(name)`)
      .is('assigned_to', null)
      .in('status', [...ACTIVE_LEAD_STATUSES])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(MY_DAY_LIMIT),
  ])

  return {
    tasks: (tasksRes.data ?? [])
      .map(toMyTask)
      .sort((a, b) => {
        if (!a.action_at) return 1
        if (!b.action_at) return -1
        return new Date(a.action_at).getTime() - new Date(b.action_at).getTime()
      })
      .slice(0, MY_DAY_LIMIT),
    myLeads: (myLeadsRes.data ?? []).map((row) => toActionLead(row, 'updated_at')),
    unassignedLeads: (unassignedRes.data ?? []).map((row) => toActionLead(row, 'created_at')),
  }
}
