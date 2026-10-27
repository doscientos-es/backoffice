import { describe, expect, it } from 'vitest'

import {
  buildPriceSuggestion,
  DEFAULT_HOURLY_RATE_EUR,
  resolveHourlyRate,
} from './price-suggestion'

const base = { scope_summary: 'x', assumptions: [], missing_info: [], confidence: 0.6 }

describe('price suggestion', () => {
  it('computes euros from hours, rounding to 50 and using the midpoint as recommendation', () => {
    const result = buildPriceSuggestion(
      {
        ...base,
        items: [
          { name: 'Backend', hours_min: 20, hours_max: 30 },
          { name: 'Frontend', hours_min: 10, hours_max: 15 },
        ],
      },
      60,
    )
    expect(result.hours_min).toBe(30)
    expect(result.hours_max).toBe(45)
    expect(result.min).toBe(1800)
    expect(result.max).toBe(2700)
    expect(result.recommended).toBe(2250)
    expect(result.items[0]).toMatchObject({ price_min: 1200, price_max: 1800 })
  })

  it('fixes inverted hour ranges', () => {
    const result = buildPriceSuggestion(
      { ...base, items: [{ name: 'A', hours_min: 10, hours_max: 5 }] },
      100,
    )
    expect(result.items[0]).toMatchObject({ hours_min: 5, hours_max: 10 })
    expect(result.min).toBeLessThanOrEqual(result.max)
  })

  it('falls back to the default rate for invalid configuration', () => {
    expect(resolveHourlyRate('75')).toBe(75)
    expect(resolveHourlyRate('abc')).toBe(DEFAULT_HOURLY_RATE_EUR)
    expect(resolveHourlyRate('-5')).toBe(DEFAULT_HOURLY_RATE_EUR)
    expect(resolveHourlyRate(undefined)).toBe(DEFAULT_HOURLY_RATE_EUR)
  })
})
