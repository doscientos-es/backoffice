import { describe, expect, it } from 'vitest'

import {
  hasMenosliosAuthorization,
  menosliosBookingContext,
  menosliosIntake,
  menosliosPayload,
} from './menoslios'

const tenantId = '00000000-0000-4000-8000-000000000001'
const leadId = '00000000-0000-4000-8000-000000000002'
const guest = { tenantId, company: 'Demo <script>', name: 'Demo', email: 'Demo@example.test' }
const booked = {
  ...guest,
  kind: 'booking',
  booking: {
    start: '2026-12-04T12:30:00+01:00',
    seats: 3,
    interval: 'month',
    modules: ['workers', 'ai'],
  },
}

describe('Menoslios / CRM contract', () => {
  it('uses the same immutable tenant identity for registration and booking', () => {
    const a = menosliosIntake(
      menosliosPayload.parse({ ...guest, kind: 'registration', booking: null }),
    )
    const b = menosliosIntake(menosliosPayload.parse(booked))
    expect(a).toEqual(b)
    expect(a).toMatchObject({
      externalId: tenantId,
      externalSource: 'menoslios',
      exactIdentityOnly: true,
      source: 'Menoslios (Ábaco)',
      email: 'demo@example.test',
    })
  })

  it('validates authenticated delivery and booking fields', () => {
    const secret = 'a'.repeat(32)
    expect(hasMenosliosAuthorization(`Bearer ${secret}`, secret)).toBe(true)
    expect(hasMenosliosAuthorization(`Bearer ${secret}b`, secret)).toBe(false)
    expect(hasMenosliosAuthorization('Bearer short', 'short')).toBe(false)
    expect(
      menosliosPayload.safeParse({ ...booked, booking: { ...booked.booking, seats: 0 } }).success,
    ).toBe(false)
  })

  it('renders escaped context and a stable private-calendar deduplication key', () => {
    const value = menosliosPayload.parse(booked)
    if (value.kind !== 'booking') throw new Error('Expected booking')
    const a = menosliosBookingContext(value, leadId, 'https://bo.example.test')
    const b = menosliosBookingContext(value, leadId, 'https://bo.example.test')
    expect(a.idempotency).toEqual(b.idempotency)
    expect(a.interactionId).toEqual(b.interactionId)
    expect(a.description).toContain('Demo &lt;script&gt;')
    expect(a.description).toContain('Plazas: 3')
    expect(a.description).toContain('Trabajadores, IA')
    expect(a.description).toContain(`https://bo.example.test/leads/${leadId}`)
    expect(a.end.valueOf() - a.start.valueOf()).toBe(30 * 60_000)
  })
})
