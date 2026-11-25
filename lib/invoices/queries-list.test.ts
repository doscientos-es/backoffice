import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ error: vi.fn() }) }))

import { invoiceConcepts, listInvoices } from './queries'

const invoiceQueries: Array<{
  select: string
  filters: Map<string, unknown>
}> = []

beforeEach(() => {
  vi.clearAllMocks()
  invoiceQueries.length = 0
  mocks.from.mockImplementation((table: string) => {
    const state = { select: '', filters: new Map<string, unknown>() }
    if (table === 'invoices') invoiceQueries.push(state)
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    query.select = vi.fn((select: string) => {
      state.select = select
      return query
    })
    for (const method of ['eq', 'is', 'gte', 'in']) {
      query[method] = vi.fn((key: string, value: unknown) => {
        state.filters.set(key, value)
        return query
      })
    }
    for (const method of ['or', 'order', 'range']) query[method] = vi.fn(() => query)
    // oxlint-disable-next-line unicorn/no-thenable -- Supabase queries are awaitable.
    query.then = vi.fn((resolve, reject) => {
      const status = state.filters.get('status')
      const data = state.select === 'total' ? [{ total: status === 'issued' ? 100 : 50 }] : []
      return Promise.resolve({ data, count: 1, error: null }).then(resolve, reject)
    })
    return query
  })
})

describe('invoiceConcepts', () => {
  it('returns non-empty concepts in invoice line order', () => {
    expect(
      invoiceConcepts([
        { description: 'Mantenimiento', position: 2 },
        { description: '  Diseño web  ', position: 0 },
        { description: '', position: 1 },
      ]),
    ).toEqual(['Diseño web', 'Mantenimiento'])
  })
})

describe('listInvoices loading', () => {
  it('filters historical and current billing documents by their lead, without changing global totals', async () => {
    const result = await listInvoices({ leadId: 'lead-1' })
    const list = invoiceQueries.find((query) => query.select.includes('full_number'))
    expect(list?.filters.get('lead_id')).toBe('lead-1')
    expect(list?.filters.has('client_id')).toBe(false)
    expect(mocks.from).not.toHaveBeenCalledWith('clients')
    expect(invoiceQueries.filter((query) => query.filters.has('lead_id'))).toHaveLength(1)
    expect(result.stats).toEqual({
      pendingTotal: 100,
      pendingCount: 1,
      overdueTotal: 50,
      overdueCount: 1,
      paidMonthTotal: 50,
      verifactuKoCount: 1,
    })
  })

  it('does not look up a client when no lead is selected', async () => {
    await listInvoices({ status: 'issued', verifactu: 'accepted' })
    expect(mocks.from).not.toHaveBeenCalledWith('clients')
    const list = invoiceQueries.find((query) => query.select.includes('full_number'))
    expect(list?.filters.get('status')).toBe('issued')
    expect(list?.filters.get('verifactu_status')).toBe('accepted')
  })

  it('can isolate Ábaco invoices without filtering by client', async () => {
    await listInvoices({ billingSource: 'abaco_subscription', status: 'paid' })
    const list = invoiceQueries.find((query) => query.select.includes('full_number'))
    expect(list?.filters.get('billing_source')).toBe('abaco_subscription')
    expect(list?.filters.get('status')).toBe('paid')
    expect(mocks.from).not.toHaveBeenCalledWith('clients')
  })
})
