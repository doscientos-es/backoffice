import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  find: vi.fn(),
  sync: vi.fn(),
  ingest: vi.fn(),
  conversion: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ serverEnv: () => ({ CAL_WEBHOOK_SECRET: 'test-only' }) }))
vi.mock('@/lib/integrations/cal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/integrations/cal')>()),
  verifyCalSignature: () => true,
}))
vi.mock('@/lib/integrations/cal-reminders', () => ({
  findCalBookingLead: state.find,
  syncCalBookingReminder: state.sync,
}))
vi.mock('@/lib/integrations/lead-intake', () => ({ ingestLead: state.ingest }))
vi.mock('@/lib/integrations/conversion-events', () => ({ recordConversionEvent: state.conversion }))
vi.mock('@/lib/integrations/meta-capi', () => ({ pushMetaQualifiedLeadStage: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const query = {
        update: () => query,
        eq: () => query,
        select: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async () => ({ error: null }),
      }
      return query
    },
  }),
}))

import type { NextRequest } from 'next/server'

import { POST } from './route'

const payload = {
  triggerEvent: 'BOOKING_RESCHEDULED',
  createdAt: '2099-01-01T00:00:00Z',
  payload: {
    uid: 'booking-new',
    rescheduleUid: 'booking-old',
    bookingId: 1,
    title: 'Reunión',
    startTime: '2099-01-20T10:00:00Z',
    endTime: '2099-01-20T11:00:00Z',
    attendees: [{ email: 'guest@example.test', name: 'Guest', timeZone: 'UTC' }],
    organizer: { email: 'organizer@example.test', name: 'Organizer' },
  },
}
const request = () =>
  new Request('https://example.test/api/webhooks/cal', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as NextRequest

describe('Cal webhook booking reminder', () => {
  beforeEach(() => {
    state.find.mockReset().mockResolvedValue('lead-existing')
    state.ingest
      .mockReset()
      .mockResolvedValue({ ok: true, leadId: 'lead-existing', duplicate: true })
    state.sync.mockReset().mockResolvedValue(undefined)
    state.conversion.mockReset().mockResolvedValue(undefined)
  })

  it('links a rescheduling to the previous lead and synchronizes its reminder', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(state.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ mergeIntoLeadId: 'lead-existing' }),
    )
    expect(state.sync).toHaveBeenCalledWith(expect.anything(), 'lead-existing', payload)
  })

  it('returns a retryable error rather than acknowledging a failed reminder', async () => {
    state.sync.mockRejectedValue(new Error('write failed'))
    expect((await POST(request())).status).toBe(500)
  })
})
