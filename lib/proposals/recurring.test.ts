import { describe, expect, it } from 'vitest'

import {
  annualProratedAmount,
  annualProration,
  calendarYearMonthsRemaining,
  ensureCalendarYearProration,
  recurringPaymentTerms,
  recurringAmount,
} from './recurring'

describe('proposal recurring billing', () => {
  it('converts the monthly maintenance price into the selected period', () => {
    expect(recurringAmount(100, 'monthly')).toBe(100)
    expect(recurringAmount(100, 'quarterly')).toBe(300)
    expect(recurringAmount(100, 'yearly')).toBe(1200)
  })

  it('prorates an annual service until the following 1 January', () => {
    expect(annualProration('2026-07-01')).toEqual({
      endDate: '2027-01-01',
      percentage: 50.41,
    })
  })

  it('keeps a 1 January start as a complete annual period', () => {
    expect(annualProration('2026-01-01')).toEqual({
      endDate: '2027-01-01',
      percentage: 100,
    })
  })
})

describe('calendar-year recurring proposal billing', () => {
  const annualLine = {
    id: 'annual-1',
    description: 'Hosting anual',
    quantity: 1,
    unit_price: 100,
    vat_rate: 21,
    billing_cycle: 'yearly' as const,
  }

  it('counts the current month in the first calendar-year period', () => {
    expect(calendarYearMonthsRemaining('2026-09-21')).toBe(4)
    expect(annualProratedAmount(annualLine, '2026-09-21')).toBe(33.33)
  })

  it('adds a one-time prorated line while preserving the annual renewal line', () => {
    const lines = ensureCalendarYearProration([annualLine], '2026-09-21')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ billing_cycle: 'yearly', unit_price: 100 })
    expect(lines[1]).toMatchObject({
      billing_cycle: 'none',
      quantity: 1,
      unit_price: 33.33,
      vat_rate: 21,
    })
  })

  it('does not duplicate an existing proportional line', () => {
    const lines = ensureCalendarYearProration(
      [
        annualLine,
        {
          ...annualLine,
          id: 'initial-1',
          description: 'Parte proporcional de Hosting anual',
          billing_cycle: 'none',
          unit_price: 1,
        },
      ],
      '2026-09-21',
    )
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatchObject({ id: 'initial-1', unit_price: 33.33 })
  })

  it('generates transparent annual payment terms', () => {
    expect(recurringPaymentTerms([annualLine], '2026-09-21')).toContain('1 de enero')
    expect(recurringPaymentTerms([annualLine], '2026-09-21')).toContain('IPC general')
    expect(recurringPaymentTerms([annualLine], '2026-09-21')).toContain('4 meses')
  })
})