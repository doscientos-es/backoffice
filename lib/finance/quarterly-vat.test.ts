import { describe, expect, it } from 'vitest'

import { quarterlyPeriod } from '@/lib/exports/quarterly-invoices'

import { calculateQuarterlyVat } from './quarterly-vat'

const firstQuarter = quarterlyPeriod('2028', '1')!
const eur = (tax_amount: number | string | null) => ({ tax_amount, currency: 'EUR' })

describe('quarterly VAT forecast', () => {
  it('projects the accumulated VAT difference over the whole quarter', () => {
    const result = calculateQuarterlyVat(
      firstQuarter,
      '2028-02-29',
      [eur(210), eur('0.10'), eur('0.20')],
      [eur(90)],
    )
    expect(result).toMatchObject({
      charged: 210.3,
      paid: 90,
      balance: 120.3,
      projectedBalance: 182.46,
      reserve: 182.46,
      elapsedDays: 60,
      totalDays: 91,
    })
  })

  it('never recommends a negative reserve and retains the negative balance', () => {
    const result = calculateQuarterlyVat(firstQuarter, '2028-03-31', [eur(10)], [eur(30)])
    expect(result).toMatchObject({ balance: -20, projectedBalance: -20, reserve: 0 })
  })

  it('flags foreign currency, missing tax and rectifications without converting or inventing values', () => {
    const result = calculateQuarterlyVat(
      firstQuarter,
      '2028-01-01',
      [eur(21), { ...eur(-5), is_rectification: true }, { tax_amount: 100, currency: 'USD' }],
      [eur(null), { tax_amount: 4, currency: null }],
    )
    expect(result).toMatchObject({
      charged: 16,
      paid: 0,
      excludedCurrencyCount: 2,
      missingTaxCount: 1,
      rectificationCount: 1,
    })
  })

  it('rejects dates outside the requested quarter', () => {
    expect(() => calculateQuarterlyVat(firstQuarter, '2028-04-01', [], [])).toThrow(
      'Fecha fuera del trimestre',
    )
  })
})
