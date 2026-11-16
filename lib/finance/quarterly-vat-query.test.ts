import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  calls: [] as Array<{ table: string; operation: string; args: unknown[] }>,
  errorTable: '',
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from(table: string) {
      let rows = db.rows[table] ?? []
      const chain = {
        select: (...args: unknown[]) => record('select', args),
        is: (column: string, value: unknown) =>
          filter('is', column, value, (item) => item === value),
        gte: (column: string, value: string) =>
          filter('gte', column, value, (item) => String(item) >= value),
        lte: (column: string, value: string) =>
          filter('lte', column, value, (item) => String(item) <= value),
        in: (column: string, value: unknown[]) =>
          filter('in', column, value, (item) => value.includes(item)),
        neq: (column: string, value: unknown) =>
          filter('neq', column, value, (item) => item !== value),
        order: (...args: unknown[]) => record('order', args),
        range: async (start: number, end: number) => {
          db.calls.push({ table, operation: 'range', args: [start, end] })
          return db.errorTable === table
            ? { data: null, error: { message: 'database error' } }
            : { data: rows.slice(start, end + 1), error: null }
        },
      }
      function record(operation: string, args: unknown[]) {
        db.calls.push({ table, operation, args })
        return chain
      }
      function filter(
        operation: string,
        column: string,
        value: unknown,
        predicate: (item: unknown) => boolean,
      ) {
        rows = rows.filter((row) => predicate(row[column]))
        return record(operation, [column, value])
      }
      return chain
    },
  }),
}))

import { getQuarterlyVatForecast } from './quarterly-vat-query'

describe('quarterly VAT query', () => {
  beforeEach(() => {
    db.rows = { invoices: [], expenses: [] }
    db.calls = []
    db.errorTable = ''
  })

  it('uses only current-quarter documents through today, including unpaid and rectified invoices', async () => {
    const invoice = { issue_date: '2026-11-01', tax_amount: 21, currency: 'EUR', deleted_at: null }
    const expense = { expense_date: '2026-10-01', tax_amount: 5, currency: 'EUR', deleted_at: null }
    db.rows.invoices = [
      { ...invoice, status: 'issued' },
      { ...invoice, status: 'rectified' },
      { ...invoice, status: 'draft' },
      { ...invoice, status: 'paid', issue_date: '2026-11-17' },
      { ...invoice, status: 'paid', issue_date: '2026-09-30' },
      { ...invoice, status: 'paid', deleted_at: '2026-11-01' },
    ]
    db.rows.expenses = [
      { ...expense, status: 'pending' },
      { ...expense, status: 'cancelled' },
      { ...expense, status: 'paid', expense_date: '2026-12-01' },
    ]

    const result = await getQuarterlyVatForecast('2026-11-16')
    expect(result).toMatchObject({
      period: { label: 'T4 2026' },
      charged: 42,
      paid: 5,
      balance: 37,
    })
    expect(db.calls).toContainEqual({ table: 'invoices', operation: 'order', args: ['id'] })
  })

  it('reads all pages instead of silently truncating at the Supabase row limit', async () => {
    db.rows.invoices = Array.from({ length: 1001 }, () => ({
      issue_date: '2026-10-01',
      tax_amount: 1,
      currency: 'EUR',
      status: 'paid',
      deleted_at: null,
    }))
    const result = await getQuarterlyVatForecast('2026-11-16')
    expect(result.charged).toBe(1001)
    expect(db.calls).toContainEqual({ table: 'invoices', operation: 'range', args: [1000, 1999] })
  })

  it('fails rather than showing a misleading zero when a query fails', async () => {
    db.errorTable = 'expenses'
    await expect(getQuarterlyVatForecast('2026-11-16')).rejects.toThrow('database error')
  })
})
