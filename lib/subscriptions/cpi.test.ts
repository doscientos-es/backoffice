import { describe, expect, it } from 'vitest'

import { madridCalendar, parseLatestCpiRate } from './cpi'

describe('subscription CPI automation', () => {
  it('reads the latest annual rate from an INE series response', () => {
    expect(parseLatestCpiRate({ Data: [{ Valor: 2.9 }] })).toBe(2.9)
  })

  it('supports the array form returned by some INE endpoints', () => {
    expect(parseLatestCpiRate([{ Data: [{ Valor: -0.4 }] }])).toBe(-0.4)
  })

  it('returns null for malformed responses', () => {
    expect(parseLatestCpiRate({ Data: [{ Valor: '2.9' }] })).toBeNull()
  })

  it('uses Europe/Madrid to identify the adjustment month', () => {
    expect(madridCalendar(new Date('2027-01-01T00:30:00.000Z'))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    })
  })
})
