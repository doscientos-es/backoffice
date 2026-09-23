import { beforeEach, describe, expect, it, vi } from 'vitest'

const dispatchNotifications = vi.fn()

vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/notifications/dispatch', () => ({ dispatchNotifications }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))

type QueryResult = { data?: unknown; error?: unknown; count?: number | null }

const state: { results: QueryResult[] } = { results: [] }

function query(): QueryResult & Record<string, unknown> {
  const result = state.results.shift() ?? {}
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'is', 'insert']) {
    chain[method] = () => chain
  }
  chain.maybeSingle = () => Promise.resolve(result)
  chain.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve)
  return chain as QueryResult & Record<string, unknown>
}

const admin = { from: () => query() }

const proposal = {
  id: 'proposal-1',
  number: 'P-2026-001',
  title: 'Web',
  lead_id: 'lead-1',
  client_id: 'client-1',
  created_by: 'author-1',
}

describe('recordClientProposalView', () => {
  beforeEach(() => {
    dispatchNotifications.mockReset()
    state.results = []
  })

  it('notifies the lead owner and logs the first open', async () => {
    state.results = [
      { count: 1 },
      {},
      { data: { assigned_to: 'owner-1' } },
    ]
    const { recordClientProposalView } = await import('./record-client-view')

    await recordClientProposalView(proposal, 'portal')

    expect(dispatchNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['owner-1'],
        eventType: 'proposal_viewed',
        entityId: 'proposal-1',
        link: '/leads/lead-1',
        body: 'Ha abierto el presupuesto · P-2026-001',
      }),
    )
  })

  it('stays quiet on a reload', async () => {
    state.results = [{ count: 3 }]
    const { recordClientProposalView } = await import('./record-client-view')

    await recordClientProposalView(proposal, 'deck')

    expect(dispatchNotifications).not.toHaveBeenCalled()
  })

  it('falls back to the proposal author when the lead has no owner', async () => {
    state.results = [{ count: 1 }, {}, { data: { assigned_to: null } }]
    const { recordClientProposalView } = await import('./record-client-view')

    await recordClientProposalView(proposal, 'deck')

    expect(dispatchNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['author-1'],
        body: 'Ha abierto la presentación · P-2026-001',
      }),
    )
  })
})
