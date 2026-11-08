import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ authorized: true, schedule: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: async () => ({ data: state.authorized, error: null }) }),
}))
vi.mock('@/lib/env', () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  },
}))
vi.mock('@/lib/ratelimit', () => ({ distributedRateLimit: async () => ({ success: true }) }))
vi.mock('@/lib/leads/mcp-meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/leads/mcp-meetings')>()
  return { ...actual, scheduleMcpMeeting: state.schedule }
})

import { POST } from './route'

const input = {
  leadId: '11111111-1111-4111-8111-111111111111',
  kind: 'meet',
  title: 'Reunión',
  start: '2099-08-10T10:00:00Z',
  end: '2099-08-10T11:00:00Z',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  confirm: true,
}
const request = (body: string, token = 'a'.repeat(48)) =>
  new Request('https://app.example.test/api/integrations/mcp/meetings', {
    method: 'POST',
    headers: { 'x-mcp-api-key': token },
    body,
  })

beforeEach(() => {
  state.authorized = true
  state.schedule.mockReset().mockResolvedValue({ eventId: 'event' })
})

describe('MCP meetings endpoint', () => {
  it('rejects missing or invalid credentials before any scheduling', async () => {
    expect((await POST(request(JSON.stringify(input), ''))).status).toBe(401)
    state.authorized = false
    expect((await POST(request(JSON.stringify(input)))).status).toBe(401)
    expect(state.schedule).not.toHaveBeenCalled()
  })

  it('validates confirmation and body size before scheduling', async () => {
    expect((await POST(request(JSON.stringify({ ...input, confirm: false })))).status).toBe(400)
    expect((await POST(request('a'.repeat(12_001)))).status).toBe(413)
    expect(state.schedule).not.toHaveBeenCalled()
  })

  it('schedules a validated authorized request', async () => {
    const response = await POST(request(JSON.stringify(input)))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, data: { eventId: 'event' } })
    expect(state.schedule).toHaveBeenCalledWith(input)
  })
})
