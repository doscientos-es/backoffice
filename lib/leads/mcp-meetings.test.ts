import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  lead: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ana',
    alias: 'Nube',
    company: 'Acme',
    email: 'ana@example.test',
    phone: '600123123',
    assigned_to: null,
  },
  writes: [] as Array<{ table: string; row: Record<string, unknown>; options: unknown }>,
  failedTable: '',
  insertEvent: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  isGoogleEnabled: () => true,
  serverEnv: () => ({ GOOGLE_CALENDAR_ID: 'team' }),
}))
vi.mock('@/lib/google/client', () => ({ resolveSubject: () => 'organizer@doscientos.es' }))
vi.mock('@/lib/google/calendar', () => ({ insertEvent: state.insertEvent }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        maybeSingle: async () => ({ data: state.lead, error: null }),
        upsert: async (row: Record<string, unknown>, options: unknown) => {
          state.writes.push({ table, row, options })
          return { error: state.failedTable === table ? { message: 'db error' } : null }
        },
      }
      return query
    },
  }),
}))

import { McpMeetingInput, scheduleMcpMeeting } from './mcp-meetings'

const input = {
  leadId: '11111111-1111-4111-8111-111111111111',
  kind: 'meet' as const,
  title: 'Reunión con Nube',
  start: '2099-08-10T10:00:00+02:00',
  end: '2099-08-10T11:00:00+02:00',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  confirm: true as const,
}

beforeEach(() => {
  state.lead.email = 'ana@example.test'
  state.lead.phone = '600123123'
  state.failedTable = ''
  state.writes = []
  state.insertEvent
    .mockReset()
    .mockResolvedValue({
      id: 'event',
      htmlLink: 'https://calendar.test/event',
      meetUrl: 'https://meet.test/event',
    })
})

describe('MCP meeting scheduling', () => {
  it('requires confirmation, a stable key and offset-aware dates', () => {
    expect(McpMeetingInput.safeParse({ ...input, confirm: false }).success).toBe(false)
    expect(McpMeetingInput.safeParse({ ...input, idempotencyKey: undefined }).success).toBe(false)
    expect(McpMeetingInput.safeParse({ ...input, start: '2099-08-10T10:00:00' }).success).toBe(
      false,
    )
  })

  it('invites sales and the lead, sanitizes shared content and records a meeting and reminder', async () => {
    const result = await scheduleMcpMeeting(input)
    expect(state.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'organizer@doscientos.es',
        summary: 'Reunión con Acme',
        attendees: ['sales@doscientos.es', 'ana@example.test'],
        withMeet: true,
        sendUpdates: 'all',
      }),
    )
    expect(result).toMatchObject({
      crmRecorded: true,
      internalReminderCreated: true,
      meetLinkPending: false,
    })
    expect(state.writes).toHaveLength(2)
    expect(state.writes[0]).toMatchObject({
      table: 'lead_interactions',
      row: { type: 'meeting', lead_id: input.leadId },
      options: { ignoreDuplicates: true },
    })
    expect(state.writes[1]).toMatchObject({ table: 'tasks', row: { action_type: 'meeting' } })
  })

  it('creates phone calls without Meet and requires phone and email before any invitation', async () => {
    await scheduleMcpMeeting({ ...input, kind: 'phone' })
    expect(state.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        withMeet: false,
        description: 'Reunión telefónica. Teléfono: 600123123',
      }),
    )
    expect(state.writes[1]?.row.action_type).toBe('call')
    state.insertEvent.mockClear()
    state.lead.phone = ''
    await expect(scheduleMcpMeeting({ ...input, kind: 'phone' })).rejects.toThrow('teléfono')
    state.lead.email = ''
    await expect(scheduleMcpMeeting(input)).rejects.toThrow('correo')
    expect(state.insertEvent).not.toHaveBeenCalled()
  })

  it('reports partial CRM failure and uses the same IDs and fingerprint on retry', async () => {
    state.failedTable = 'tasks'
    const result = await scheduleMcpMeeting(input)
    expect(result).toMatchObject({
      crmRecorded: true,
      internalReminderCreated: false,
      retryWithSameKey: true,
    })
    const firstEvent = state.insertEvent.mock.calls[0]?.[0]
    const firstIds = state.writes.map((write) => write.row.id)
    state.writes = []
    state.failedTable = ''
    await scheduleMcpMeeting(input)
    expect(state.insertEvent.mock.calls[1]?.[0].idempotency).toEqual(firstEvent.idempotency)
    expect(state.writes.map((write) => write.row.id)).toEqual(firstIds)
  })

  it('waits for the Meet link before recording the CRM interaction', async () => {
    state.insertEvent.mockResolvedValueOnce({ id: 'event', htmlLink: null, meetUrl: null })
    const result = await scheduleMcpMeeting(input)
    expect(result).toMatchObject({
      meetLinkPending: true,
      crmRecorded: false,
      retryWithSameKey: true,
    })
    expect(state.writes.map((write) => write.table)).toEqual(['tasks'])
    state.writes = []
    await scheduleMcpMeeting(input)
    expect(state.writes.map((write) => write.table)).toEqual(['lead_interactions', 'tasks'])
  })
})
