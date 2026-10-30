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
  for (const method of ['select', 'eq', 'is', 'insert', 'order', 'limit', 'gte']) {
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
    state.results = [{ count: 1 }, {}, { data: { assigned_to: 'owner-1' } }]
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
    const now = Date.now()
    state.results = [
      { count: 3 },
      {
        data: [
          { viewed_at: new Date(now).toISOString() },
          { viewed_at: new Date(now - 5 * 60_000).toISOString() },
        ],
      },
    ]
    const { recordClientProposalView } = await import('./record-client-view')

    await recordClientProposalView(proposal, 'deck')

    expect(dispatchNotifications).not.toHaveBeenCalled()
  })

  it('notifies when the lead comes back after a long gap', async () => {
    const now = Date.now()
    state.results = [
      { count: 2 },
      {
        data: [
          { viewed_at: new Date(now).toISOString() },
          { viewed_at: new Date(now - 24 * 60 * 60_000).toISOString() },
        ],
      },
      { data: { assigned_to: 'owner-1' } },
    ]
    const { recordClientProposalView } = await import('./record-client-view')

    await recordClientProposalView(proposal, 'portal')

    expect(dispatchNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['owner-1'],
        body: 'Ha vuelto a abrir el presupuesto · P-2026-001 (2 visitas)',
      }),
    )
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

describe('recordClientSignIntent', () => {
  beforeEach(() => {
    dispatchNotifications.mockReset()
    state.results = []
  })

  it('notifies once when the signature form is opened', async () => {
    state.results = [{ count: 0 }, { data: { assigned_to: 'owner-1' } }]
    const { recordClientSignIntent } = await import('./record-client-view')

    await recordClientSignIntent(proposal)

    expect(dispatchNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['owner-1'],
        body: 'Está revisando la firma · P-2026-001. Buen momento para escribirle',
      }),
    )
  })

  it('does not repeat within the same day', async () => {
    state.results = [{ count: 1 }]
    const { recordClientSignIntent } = await import('./record-client-view')

    await recordClientSignIntent(proposal)

    expect(dispatchNotifications).not.toHaveBeenCalled()
  })
})
