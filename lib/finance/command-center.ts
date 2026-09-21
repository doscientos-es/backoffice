import { createServerClient } from '@/lib/supabase/server'

export type CommandCenterMetrics = { revenue: number; invoiceCount: number; directCosts: number; fixedCosts: number; hours: number; adSpend: number; newLeads: number; wonLeads: number }

export async function getCommandCenterMetrics(since: string, until: string): Promise<CommandCenterMetrics> {
  const supabase = await createServerClient()
  const [invoices, expenses, logs, insights, leads] = await Promise.all([
    supabase.from('invoices').select('total, subtotal').gte('issue_date', since).lte('issue_date', until).in('status', ['issued', 'paid', 'overdue']).is('deleted_at', null),
    supabase.from('expenses').select('total, subtotal, project_id').gte('expense_date', since).lte('expense_date', until).neq('status', 'cancelled').is('deleted_at', null),
    supabase.from('work_logs').select('hours').gte('work_date', since).lte('work_date', until).is('deleted_at', null),
    supabase.from('marketing_insights').select('spend').gte('date_start', since).lte('date_start', until),
    supabase.from('leads').select('status').gte('created_at', `${since}T00:00:00.000Z`).lte('created_at', `${until}T23:59:59.999Z`).is('deleted_at', null),
  ])
  const revenueRows = invoices.data ?? [], expenseRows = expenses.data ?? []
  const base = (row: { subtotal?: unknown; total?: unknown }) => Number(row.subtotal ?? row.total ?? 0)
  return { revenue: revenueRows.reduce((s, r) => s + base(r), 0), invoiceCount: revenueRows.length,
    directCosts: expenseRows.filter(r => r.project_id).reduce((s, r) => s + base(r), 0), fixedCosts: expenseRows.filter(r => !r.project_id).reduce((s, r) => s + base(r), 0),
    hours: (logs.data ?? []).reduce((s, r) => s + Number(r.hours ?? 0), 0), adSpend: (insights.data ?? []).reduce((s, r) => s + Number(r.spend ?? 0), 0),
    newLeads: leads.data?.length ?? 0, wonLeads: (leads.data ?? []).filter(r => r.status === 'won').length }
}
