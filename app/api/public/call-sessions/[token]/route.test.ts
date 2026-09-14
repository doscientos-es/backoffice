import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    session: null as Record<string, unknown> | null,
    update: null as Record<string, unknown> | null,
  },
}))

vi.mock('@/lib/ratelimit', () => ({ distributedRateLimit: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      let updating = false
      const query = {
        select: () => query,
        eq: () => query,
        gt: () => query,
        in: () => query,
        update: (value: Record<string, unknown>) => {
          updating = true
          state.update = value
          return query
        },
        maybeSingle: async () => ({ data: updating ? { id: 'session-1' } : state.session, error: null }),
      }
      return query
    },
  }),
}))

import { POST } from './route'

const token = '00000000-0000-4000-8000-000000000001'
const context = { params: Promise.resolve({ token }) }

function request(action: 'dial' | 'finish') {
  return new Request(`https://backoffice.test/api/public/call-sessions/${token}`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

describe('public call session route', () => {
  beforeEach(() => {
    state.update = null
    state.session = {
      id: 'session-1',
      status: 'started',
      started_at: '2026-09-10T10:00:00.000Z',
      dialed_at: null,
      finished_at: null,
      expires_at: '2099-01-01T00:00:00.000Z',
    }
  })

  it('rejects a malformed capability token before querying the database', async () => {
    const response = await POST(request('dial') as never, {
      params: Promise.resolve({ token: 'not-a-token' }),
    })

    expect(response.status).toBe(400)
  })

  it('marks a valid session as dialing only after the mobile user confirms', async () => {
    const response = await POST(request('dial') as never, context)

    expect(response.status).toBe(200)
    expect(state.update).toMatchObject({ status: 'dialing', dialed_at: expect.any(String) })
  })

  it('closes an active session with an estimated duration', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T10:02:00.000Z'))

    const response = await POST(request('finish') as never, context)

    expect(await response.json()).toMatchObject({ ok: true, durationMinutes: 2, defaultOutcome: 'connected' })
    expect(state.update).toMatchObject({ status: 'awaiting_log', duration_seconds: 120 })
    vi.useRealTimers()
  })
})