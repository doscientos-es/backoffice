import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { writes: [] as Array<Record<string, unknown>> },
}))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-model' },
  isAIEnabled: () => true,
  runAIObject: vi.fn(async () => ({
    questions: [
      {
        question: 'Quien toma la decision',
        category: 'decision',
        rationale: 'Aclarar el proceso de aprobación.',
        priority: 1,
      },
      {
        question: '¿Qué sistemas deben integrarse con la solución?',
        category: 'integrations',
        rationale: 'Puede afectar el alcance técnico.',
        priority: 2,
      },
      {
        question: 'Que sistemas deben integrarse con la solucion',
        category: 'integrations',
        rationale: 'Duplicada dentro del resultado.',
        priority: 2,
      },
    ],
  })),
}))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'member-1', role: 'member' })),
}))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/leads/queries', () => ({
  getLeadDetail: vi.fn(async () => ({
    lead: { name: 'Acme', status: 'qualifying' },
    discoveryQuestions: [
      {
        id: 'question-1',
        question: '¿Quién toma la decisión?',
        status: 'open',
        answer: null,
        suggested_answer: null,
      },
    ],
    interactions: [],
  })),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const builder = Object.assign(Promise.resolve({ data: null, error: null }), {
        insert(values: unknown) {
          state.writes.push({ table, values })
          return builder
        },
      })
      return builder
    },
  }),
}))

import { POST } from './route'

describe('POST /api/crm/ai/discovery-questions', () => {
  beforeEach(() => {
    state.writes = []
  })

  it('saves only novel AI-generated questions and attributes them to the member', async () => {
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, added: 1 })
    expect(state.writes).toContainEqual(
      expect.objectContaining({
        table: 'lead_discovery_questions',
        values: [
          expect.objectContaining({
            question: '¿Qué sistemas deben integrarse con la solución?',
            origin: 'ai',
            created_by: 'member-1',
            priority: 2,
          }),
        ],
      }),
    )
  })
})
