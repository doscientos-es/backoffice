import { createServerClient } from '@/lib/supabase/server'

import { madridToday, quarterOf } from './quarterly-handoff'
import { calculateQuarterlyVat, type VatRow } from './quarterly-vat'

const PAGE_SIZE = 1000

export async function getQuarterlyVatForecast(today = madridToday()) {
  const period = quarterOf(today)
  const supabase = await createServerClient()

  async function loadRows(table: 'invoices' | 'expenses'): Promise<VatRow[]> {
    const rows: VatRow[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const dateColumn = table === 'invoices' ? 'issue_date' : 'expense_date'
      let query = supabase
        .from(table)
        .select(
          table === 'invoices' ? 'tax_amount, currency, is_rectification' : 'tax_amount, currency',
        )
        .is('deleted_at', null)
        .gte(dateColumn, period.start)
        .lte(dateColumn, today)
      query =
        table === 'invoices'
          ? query.in('status', ['issued', 'paid', 'overdue', 'rectified'])
          : query.neq('status', 'cancelled')
      const { data, error } = await query.order('id').range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = (data ?? []) as unknown as VatRow[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) return rows
    }
  }

  const [invoices, expenses] = await Promise.all([loadRows('invoices'), loadRows('expenses')])
  return { period, today, ...calculateQuarterlyVat(period, today, invoices, expenses) }
}
