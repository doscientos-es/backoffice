import { describe, expect, it } from 'vitest'

import { annualProration, recurringAmount } from './recurring'

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
