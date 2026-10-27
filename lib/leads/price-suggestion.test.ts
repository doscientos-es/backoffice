import { describe, expect, it } from 'vitest'

import { buildPriceSuggestion, parseHourlyRate, toProposalLines } from './price-suggestion'

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

  it('returns null when the settings rate is missing or invalid', () => {
    expect(parseHourlyRate('75.50')).toBe(75.5)
    expect(parseHourlyRate(80)).toBe(80)
    expect(parseHourlyRate(null)).toBeNull()
    expect(parseHourlyRate('')).toBeNull()
    expect(parseHourlyRate('abc')).toBeNull()
    expect(parseHourlyRate(0)).toBeNull()
    expect(parseHourlyRate(-5)).toBeNull()
  })

  it('turns each item into one proposal line at its midpoint, with the company VAT', () => {
    const suggestion = buildPriceSuggestion(
      {
        ...base,
        items: [
          { name: 'Backend', hours_min: 20, hours_max: 30 },
          { name: 'Frontend', hours_min: 10, hours_max: 15 },
        ],
      },
      60,
      10,
    )
    const lines = toProposalLines(suggestion, suggestion.vat_rate)
    expect(lines).toEqual([
      expect.objectContaining({
        description: 'Backend',
        quantity: 1,
        unit_price: 1500,
        vat_rate: 10,
      }),
      expect.objectContaining({
        description: 'Frontend',
        quantity: 1,
        unit_price: 750,
        vat_rate: 10,
      }),
    ])
    expect(lines.reduce((sum, line) => sum + line.unit_price, 0)).toBe(suggestion.recommended)
  })
})
