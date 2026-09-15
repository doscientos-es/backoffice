import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { aiEnabled: true },
}))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-model' },
  isAIEnabled: () => state.aiEnabled,
  runAIChat: vi.fn(async () => 'Resumen de la llamada con los acuerdos y próximos pasos.'),
}))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
}))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))

import { POST } from './route'

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/crm/ai/summarize-call-notes', () => {
  it('returns a reviewable summary', async () => {
    const response = await POST(request({ text: 'A'.repeat(8_001) }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      text: 'Resumen de la llamada con los acuerdos y próximos pasos.',
    })
  })

  it('does not call AI when the integration is disabled', async () => {
    state.aiEnabled = false

    const response = await POST(request({ text: 'Notas de prueba' }))

    expect(response.status).toBe(503)
    state.aiEnabled = true
  })

  it('rejects input above the request limit', async () => {
    const response = await POST(request({ text: 'A'.repeat(50_001) }))

    expect(response.status).toBe(400)
  })
})
