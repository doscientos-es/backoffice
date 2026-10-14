import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: { role: 'sales', id: 'sales-1' },
  from: vi.fn(),
  requirePagePermission: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ requirePagePermission: mocks.requirePagePermission }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ error: vi.fn() }) }))

import { getCommercialPerformance, readPerformancePages } from './commercial-performance-queries'

const range = { since: '2026-08-01', until: '2026-08-31' }

function mockTables(rows: Record<string, unknown[]>, failedTable?: string) {
  mocks.from.mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'is', 'gte', 'lte', 'in', 'eq', 'order', 'range'])
      builder[method] = vi.fn(() => builder)
    builder.then = (resolve: (result: unknown) => unknown) =>
      Promise.resolve({
        data: rows[table] ?? [],
        error: table === failedTable ? { message: 'Query failed' } : null,
      }).then(resolve)
    return builder
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.role = 'sales'
  mocks.requirePagePermission.mockResolvedValue(mocks.user)
})

describe('readPerformancePages', () => {
  it('reads past API row limits instead of silently truncating data', async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({ id })),
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ id: 500 }], error: null })
    expect(await readPerformancePages(page)).toHaveLength(501)
    expect(page.mock.calls).toEqual([
      [0, 499],
      [500, 999],
    ])
  })
  it('fails rather than returning a partial report after an error', async () => {
    const page = vi.fn().mockResolvedValue({ data: null, error: { message: 'Denied' } })
    await expect(readPerformancePages(page)).rejects.toThrow('todos los datos')
  })
})

describe('getCommercialPerformance', () => {
  const proposal = {
    id: 'p-1',
    lead_id: null,
    clients: null,
    created_by: 'sales-1',
    status: 'accepted',
    created_at: '2026-08-01',
    sent_at: '2026-08-02',
    viewed_at: null,
    responded_at: '2026-08-03',
    delivered_at: null,
  }
  it('works when the selected period has proposals but no new leads', async () => {
    mockTables({ proposals: [proposal], proposal_prices: [{ proposal_id: 'p-1', total: 1000 }] })
    const result = await getCommercialPerformance(range)
    expect(mocks.requirePagePermission).toHaveBeenCalledWith('leads.read')
    expect(result.error).toBeNull()
    expect(result.performance).toMatchObject({
      leadCount: 0,
      proposalCount: 1,
      accepted: 1,
      acceptedValue: 1000,
    })
  })
  it('never queries or exports prices for viewers without price permission', async () => {
    mocks.user.role = 'viewer'
    mockTables({ proposals: [proposal] })
    const result = await getCommercialPerformance(range)
    expect(result.canSeePrices).toBe(false)
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('proposal_prices')
    expect(result.performance?.acceptedValue).toBeNull()
    expect(result.performance?.byMember[0]?.acceptedValue).toBeNull()
  })
  it('joins converted-client proposals back to the originating lead', async () => {
    mockTables({
      leads: [
        {
          id: 'lead-1',
          created_at: '2026-08-01',
          status: 'won',
          assigned_to: 'sales-1',
          first_contacted_at: null,
        },
      ],
      clients: [{ id: 'client-1' }],
      proposals: [
        { ...proposal, client_id: 'client-1', lead_id: null, clients: { lead_id: 'lead-1' } },
      ],
    })
    const result = await getCommercialPerformance(range)
    expect(result.performance?.proposalCount).toBe(1)
    expect(result.performance?.timing.leadToProposal.meanHours).toBe(24)
  })
  it('reports an error rather than presenting incomplete statistics', async () => {
    mockTables({}, 'proposals')
    const result = await getCommercialPerformance(range)
    expect(result.performance).toBeNull()
    expect(result.error).toContain('completas')
  })
})
