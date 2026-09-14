import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueryResult = { data: Array<{ total: number }>; count: number; error: null }
type Chain = {
  select: (_columns: string, _options?: unknown) => Chain
  is: (column: string, value: unknown) => Chain
  eq: (column: string, value: unknown) => Chain
  gte: (column: string, value: unknown) => Chain
  not: (column: string, operator: string, value: unknown) => Chain
  then: (resolve: (value: QueryResult) => void) => void
}

const filters: Array<{ column: string; value: unknown }> = []

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: () => {
      let status: string | null = null
      const chain: Chain = {
        select: () => chain,
        is: () => chain,
        eq: (column, value) => {
          if (column === 'status') status = String(value)
          return chain
        },
        gte: (column, value) => {
          filters.push({ column, value })
          return chain
        },
        not: () => chain,
        then: (resolve) => {
          const rows = status === 'issued' ? [{ total: 100 }] : status === 'overdue' ? [{ total: 50 }] : [{ total: 40 }]
          resolve({ data: rows, count: rows.length, error: null })
        },
      }
      return chain
    },
  }),
}))

describe('getAccountsReceivable', () => {
  beforeEach(() => {
    filters.length = 0
    vi.resetModules()
  })

  it('uses paid_at, not issue_date, for money collected this month', async () => {
    const { getAccountsReceivable } = await import('@/lib/dashboard/queries')
    const result = await getAccountsReceivable()

    expect(result.paidMonthTotal).toBe(40)
    expect(filters.some((filter) => filter.column === 'paid_at')).toBe(true)
    expect(filters.some((filter) => filter.column === 'issue_date')).toBe(false)
  })
})