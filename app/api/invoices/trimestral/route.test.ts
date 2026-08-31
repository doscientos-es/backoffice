import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    role: 'admin' as 'owner' | 'admin' | 'member' | 'viewer',
    fromCalls: [] as string[],
    invoiceResult: {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
    },
    expenseResult: {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error('not authenticated')
    return { id: 'user-1', role: state.role }
  }),
}))

vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => {
      state.fromCalls.push(table)
      let orderCount = 0
      const chain = {
        select: () => chain,
        is: () => chain,
        in: () => chain,
        gte: () => chain,
        lt: () => chain,
        order: () => {
          orderCount += 1
          if (orderCount < 2) return chain
          return Promise.resolve(table === 'invoices' ? state.invoiceResult : state.expenseResult)
        },
      }
      return chain
    },
  })),
}))

import { NextRequest } from 'next/server'

import { GET } from './route'

const request = (query = '') => new NextRequest(`http://localhost/api/invoices/trimestral${query}`)

describe('GET /api/invoices/trimestral', () => {
  beforeEach(() => {
    state.authThrows = false
    state.role = 'admin'
    state.fromCalls = []
    state.invoiceResult = { data: [], error: null }
    state.expenseResult = { data: [], error: null }
  })

  it('rejects unauthenticated and non-finance users', async () => {
    state.authThrows = true
    expect((await GET(request('?year=2026&quarter=3'))).status).toBe(401)

    state.authThrows = false
    state.role = 'member'
    expect((await GET(request('?year=2026&quarter=3'))).status).toBe(403)
  })

  it('validates the quarter before querying financial data', async () => {
    expect((await GET(request('?year=2026&quarter=5'))).status).toBe(400)
    expect(state.fromCalls).toEqual([])
  })

  it('returns an accountant ZIP with metadata folders even when the quarter is empty', async () => {
    const response = await GET(request('?year=2026&quarter=3'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="doscientos-T3-2026.zip"',
    )
    expect(state.fromCalls).toEqual(['invoices', 'expenses'])

    const archive = Buffer.from(await response.arrayBuffer())
    expect(archive.toString('utf8')).toContain('gastos/metadatos.csv')
    expect(archive.toString('utf8')).toContain('cobros/metadatos.csv')
  })
})
