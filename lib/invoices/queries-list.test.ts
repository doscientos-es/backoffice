import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ error: vi.fn() }) }))

import { invoiceConcepts, listInvoices } from './queries'

const invoiceQueries: Array<{
  select: string
  filters: Map<string, unknown>
  started: boolean
}> = []

beforeEach(() => {
  vi.clearAllMocks()
  invoiceQueries.length = 0
  mocks.client.mockResolvedValue({ data: null })
  mocks.from.mockImplementation((table: string) => {
    const state = { select: '', filters: new Map<string, unknown>(), started: false }
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
    query.maybeSingle = mocks.client
    // oxlint-disable-next-line unicorn/no-thenable -- Supabase queries are awaitable.
    query.then = vi.fn((resolve, reject) => {
      state.started = true
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
  it('loads summary queries while the selected lead client is unresolved', async () => {
    let finish!: (value: { data: { id: string } }) => void
    mocks.client.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const request = listInvoices({ leadId: 'lead-1' })
    try {
      await vi.waitFor(() =>
        expect(invoiceQueries.filter((query) => query.started)).toHaveLength(4),
      )
    } finally {
      finish({ data: { id: 'client-1' } })
    }
    const result = await request
    const list = invoiceQueries.find((query) => query.select.includes('full_number'))
    expect(list?.filters.get('client_id')).toBe('client-1')
    expect(result.stats).toEqual({
      pendingTotal: 100,
      pendingCount: 1,
      overdueTotal: 50,
      overdueCount: 1,
      paidMonthTotal: 50,
      verifactuKoCount: 1,
    })
  })

  it('does not return all invoices when the lead has no client', async () => {
    await listInvoices({ leadId: 'lead-1' })
    const list = invoiceQueries.find((query) => query.select.includes('full_number'))
    expect(list?.filters.has('id')).toBe(true)
    expect(list?.filters.get('id')).toBeNull()
  })

  it('does not look up a client when no lead is selected', async () => {
    await listInvoices({ status: 'issued', verifactu: 'accepted' })
    expect(mocks.from).not.toHaveBeenCalledWith('clients')
    const list = invoiceQueries.find((query) => query.select.includes('full_number'))
    expect(list?.filters.get('status')).toBe('issued')
    expect(list?.filters.get('verifactu_status')).toBe('accepted')
  })
})
