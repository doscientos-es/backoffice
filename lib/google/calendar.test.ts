import { describe, expect, it, vi } from 'vitest'

const { googleFetch, GoogleApiError } = vi.hoisted(() => ({
  googleFetch: vi.fn(),
  GoogleApiError: class GoogleApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message)
    }
  },
}))

vi.mock('./client', () => ({
  GOOGLE_SCOPES: { calendar: 'https://www.googleapis.com/auth/calendar' },
  googleFetch,
  GoogleApiError,
}))

import { insertEvent } from './calendar'

describe('insertEvent', () => {
  it('uses the video conference entry point when hangoutLink is absent', async () => {
    googleFetch.mockResolvedValueOnce({
      id: 'event-1',
      conferenceData: {
        entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }],
      },
    })

    await expect(
      insertEvent({
        subject: 'pol@doscientos.es',
        calendarId: 'team-calendar',
        summary: 'Reunión',
        start: new Date('2026-08-10T10:00:00.000Z'),
        end: new Date('2026-08-10T11:00:00.000Z'),
        withMeet: true,
      }),
    ).resolves.toMatchObject({ meetUrl: 'https://meet.google.com/abc-defg-hij' })

    expect(googleFetch).toHaveBeenCalledWith(
      'pol@doscientos.es',
      ['https://www.googleapis.com/auth/calendar'],
      expect.stringContaining('conferenceDataVersion=1'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('recovers the same event on conflict and rejects a reused key with different content', async () => {
    const input = {
      subject: 'organizer@example.test',
      calendarId: 'team',
      summary: 'Call',
      start: new Date('2030-08-10T10:00:00Z'),
      end: new Date('2030-08-10T11:00:00Z'),
      idempotency: { eventId: 'mcp12345', fingerprint: 'fingerprint' },
      sendUpdates: 'all' as const,
    }
    googleFetch
      .mockRejectedValueOnce(new GoogleApiError('conflict', 409))
      .mockResolvedValueOnce({
        id: 'mcp12345',
        extendedProperties: { private: { mcpFingerprint: 'fingerprint' } },
      })
    await expect(insertEvent(input)).resolves.toMatchObject({ id: 'mcp12345' })
    const call = googleFetch.mock.calls.at(-2)!
    expect(call[2]).toContain('sendUpdates=all')
    expect(JSON.parse(call[3].body)).toMatchObject({ id: 'mcp12345' })

    googleFetch
      .mockRejectedValueOnce(new GoogleApiError('conflict', 409))
      .mockResolvedValueOnce({
        id: 'mcp12345',
        extendedProperties: { private: { mcpFingerprint: 'other' } },
      })
    await expect(insertEvent(input)).rejects.toThrow('idempotencia')
  })

  it('does not recreate a cancelled event on retry', async () => {
    googleFetch
      .mockRejectedValueOnce(new GoogleApiError('conflict', 409))
      .mockResolvedValueOnce({ id: 'mcp12345', status: 'cancelled' })
    await expect(
      insertEvent({
        subject: 'organizer@example.test',
        calendarId: 'team',
        summary: 'Call',
        start: new Date('2030-08-10T10:00:00Z'),
        end: new Date('2030-08-10T11:00:00Z'),
        idempotency: { eventId: 'mcp12345', fingerprint: 'fingerprint' },
      }),
    ).rejects.toThrow('cancelada')
  })
})
