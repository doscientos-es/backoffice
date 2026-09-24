import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { aiEnabled: true, manualAnswer: false, writes: [] as Array<Record<string, unknown>> },
}))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-model' },
  isAIEnabled: () => state.aiEnabled,
  runAIObject: vi.fn(async () => ({
    summary: 'Se acordó revisar el alcance antes de la siguiente reunión.',
    decisions: ['Revisar el alcance'],
    open_questions: ['Confirmar interlocutores'],
    discovery_updates: [
      {
        question_id: '00000000-0000-4000-8000-000000000002',
        suggested_answer: 'Participa el jefe de operaciones.',
        evidence_excerpt: 'El jefe de operaciones toma la decisión.',
        confidence: 0.91,
      },
    ],
    tasks: [
      {
        title: 'Enviar resumen',
        description: 'Recoger el acuerdo de la llamada.',
        priority: 'high',
      },
    ],
    follow_up_focus: 'El acuerdo de alcance',
  })),
}))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
}))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const builder = Object.assign(Promise.resolve({ data: null, error: null }), {
        update(values: Record<string, unknown>) {
          state.writes.push({ table, kind: 'update', values })
          return builder
        },
        insert(values: unknown) {
          state.writes.push({ table, kind: 'insert', values })
          return builder
        },
        eq: () => builder,
        in: () => builder,
        or: () => builder,
        select: () => builder,
        maybeSingle: async () => ({ data: { id: 'question-1' }, error: null }),
      })
      return builder
    },
  }),
}))
vi.mock('@/lib/leads/queries', () => ({
  getLeadDetail: vi.fn(async () => ({
    lead: { name: 'Ana', status: 'qualifying' },
    linkedClientName: null,
    interactions: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        type: 'call',
        subject: 'Descubrimiento',
        body: null,
        payload: { transcript: 'Necesitamos un portal.' },
        created_at: '2026-08-01T10:00:00.000Z',
      },
    ],
    proposals: [],
    discoveryQuestions: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        lead_id: '00000000-0000-4000-8000-000000000001',
        question: 'Confirmar interlocutores',
        category: 'decision',
        rationale: '',
        priority: 1,
        status: 'open',
        answer: null,
        suggested_answer: null,
        answer_source: state.manualAnswer ? 'manual' : null,
        source_interaction_id: null,
        evidence_excerpt: null,
        confidence: null,
        origin: 'manual',
        sort_order: 0,
        created_at: '2026-08-01T10:00:00.000Z',
        updated_at: '2026-08-01T10:00:00.000Z',
      },
    ],
    projects: [],
    invoices: [],
    tasks: [],
    reminders: [],
    attachments: [],
  })),
}))

import { POST } from './route'

describe('POST /api/crm/ai/call-copilot', () => {
  beforeEach(() => {
    state.aiEnabled = true
    state.manualAnswer = false
    state.writes = []
  })

  it('does not call AI when the integration is disabled', async () => {
    state.aiEnabled = false
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )
    expect(response.status).toBe(503)
  })

  it('returns reviewable agreements, questions and task suggestions', async () => {
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      decisions: ['Revisar el alcance'],
      tasks: [{ title: 'Enviar resumen', priority: 'high' }],
      discovery_updates_saved: 1,
    })
    expect(state.writes).toContainEqual(
      expect.objectContaining({
        table: 'lead_discovery_questions',
        kind: 'update',
        values: expect.objectContaining({
          suggested_answer: 'Participa el jefe de operaciones.',
          evidence_excerpt: 'El jefe de operaciones toma la decisión.',
          status: 'needs_review',
        }),
      }),
    )
    expect((state.writes[0]?.values as Record<string, unknown>)?.answer).toBeUndefined()
  })

  it('does not produce an AI suggestion over a manual answer', async () => {
    state.manualAnswer = true
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(state.writes).toEqual([])
  })
})
