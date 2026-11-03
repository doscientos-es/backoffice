import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, rpc, runAIObject, getLeadDetail } = vi.hoisted(() => ({
  state: { authenticated: true, role: 'member', aiEnabled: true, allowed: true },
  rpc: vi.fn(),
  runAIObject: vi.fn(),
  getLeadDetail: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  requireUser: async () => {
    if (!state.authenticated) throw new Error('No session')
    return { id: 'synthetic-user', role: state.role }
  },
}))
vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-search', drafter: 'test-answer' },
  isAIEnabled: () => state.aiEnabled,
  runAIObject,
}))
vi.mock('@/lib/leads/queries', () => ({ getLeadDetail }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ rpc }) }))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: state.allowed }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))

import { POST } from './route'

const LEAD_ID = '00000000-0000-4000-8000-000000000001'
const INTERACTION_ID = '00000000-0000-4000-8000-000000000002'
function request(
  body: unknown = { lead_id: LEAD_ID, message: '¿Qué presupuesto hablamos en 2022?' },
) {
  return new NextRequest('http://localhost/api/crm/ai/lead-assistant', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
function planAndAnswer(sourceIds = [`interaction:${INTERACTION_ID}`]) {
  runAIObject
    .mockResolvedValueOnce({ queries: ['presupuesto'], from: null, to: null })
    .mockResolvedValueOnce({ answer: 'Se acordó revisar el presupuesto.', sourceIds, draft: null })
}

describe('POST lead assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runAIObject.mockReset()
    Object.assign(state, { authenticated: true, role: 'member', aiEnabled: true, allowed: true })
    getLeadDetail.mockResolvedValue({
      lead: { id: LEAD_ID, name: 'Synthetic Lead', notes: 'Confirmed scope' },
      proposals: [],
      tasks: [],
      projects: [],
      invoices: [],
      reminders: [],
      discoveryQuestions: [],
    })
    rpc.mockResolvedValue({
      data: {
        items: [
          {
            id: INTERACTION_ID,
            type: 'meeting',
            subject: 'Meeting in 2022',
            created_at: '2022-01-01T00:00:00Z',
            body: null,
            summary: 'Revisar presupuesto',
            truncated: false,
          },
        ],
        hasMore: false,
        nextOffset: null,
      },
      error: null,
    })
  })

  it.each([
    [{ authenticated: false }, 401],
    [{ role: 'delivery' }, 403],
    [{ aiEnabled: false }, 503],
    [{ allowed: false }, 429],
  ])(
    'rejects unavailable or unauthorized requests before AI or data access: %j',
    async (override, status) => {
      Object.assign(state, override)
      expect((await POST(request())).status).toBe(status)
      expect(runAIObject).not.toHaveBeenCalled()
      expect(getLeadDetail).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  it('rejects oversized conversations and missing/inaccessible leads without spending tokens', async () => {
    expect((await POST(request({ lead_id: LEAD_ID, message: 'x'.repeat(2001) }))).status).toBe(400)
    getLeadDetail.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(404)
    expect(runAIObject).not.toHaveBeenCalled()
  })

  it('retrieves old summaries through the session RPC, deduplicates citations and returns server-owned links', async () => {
    planAndAnswer([`interaction:${INTERACTION_ID}`, `interaction:${INTERACTION_ID}`])
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledWith(
      'search_lead_history',
      expect.objectContaining({
        p_lead_id: LEAD_ID,
        p_query: 'presupuesto',
        p_limit: 6,
        p_include_private: true,
      }),
    )
    expect(runAIObject.mock.calls[1]![0].user).toContain('Revisar presupuesto')
    const json = await response.json()
    expect(json.sources).toEqual([
      {
        id: `interaction:${INTERACTION_ID}`,
        label: 'Meeting in 2022',
        createdAt: '2022-01-01T00:00:00Z',
        href: `/leads/${LEAD_ID}/history/${INTERACTION_ID}`,
      },
    ])
    expect(json.coverage).toContain('No es todo el historial')
    expect(json.draft).toBeNull()
  })

  it('does not answer with invented citations or silently ignore failed history retrieval', async () => {
    planAndAnswer(['invented-source'])
    expect((await POST(request())).status).toBe(502)
    runAIObject.mockReset()
    planAndAnswer()
    rpc.mockResolvedValue({ data: null, error: { message: 'Synthetic RLS failure' } })
    expect((await POST(request())).status).toBe(502)
    expect(runAIObject).toHaveBeenCalledTimes(1)
  })

  it('keeps proposal prices disabled when the reader lacks that permission', async () => {
    state.role = 'viewer'
    planAndAnswer()
    expect((await POST(request())).status).toBe(200)
    expect(getLeadDetail).toHaveBeenCalledWith(LEAD_ID, { includeProposalPrices: false })
  })
})
