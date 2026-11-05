import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  result: { data: null, error: null as { code: string; message: string } | null },
  log: { error: vi.fn() },
  notFound: vi.fn(() => {
    throw new Error('not found')
  }),
}))

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/lib/auth', () => ({ requirePagePermission: vi.fn(async () => ({ role: 'owner' })) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => mocks.log }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ maybeSingle: async () => mocks.result }) }),
      }),
    }),
  })),
}))

import ProposalDetailPage from './page'

describe('ProposalDetailPage', () => {
  const request = () => ({
    params: Promise.resolve({ id: 'proposal-1' }),
    searchParams: Promise.resolve({}),
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.result.error = null
  })

  it('reports query errors rather than treating them as a missing proposal', async () => {
    mocks.result.error = { code: '42501', message: 'permission denied for table proposals' }

    await expect(ProposalDetailPage(request())).rejects.toThrow('No se pudo cargar la propuesta')
    expect(mocks.log.error).toHaveBeenCalledWith(
      { proposalId: 'proposal-1', err: mocks.result.error },
      'could not load proposal',
    )
    expect(mocks.notFound).not.toHaveBeenCalled()
  })

  it('returns not found when the query succeeds without an accessible proposal', async () => {
    await expect(ProposalDetailPage(request())).rejects.toThrow('not found')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })
})
