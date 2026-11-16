import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/finance/quarterly-vat-query', () => ({
  getQuarterlyVatForecast: async () => ({
    period: { label: 'T4 2026' },
    today: '2026-11-16',
    charged: 210,
    paid: 50,
    balance: 160,
    reserve: 300,
    elapsedDays: 47,
    totalDays: 92,
    excludedCurrencyCount: 1,
    missingTaxCount: 0,
    rectificationCount: 1,
  }),
}))

import { QuarterlyVatForecast } from './quarterly-vat-forecast'

describe('quarterly VAT forecast card', () => {
  it('shows the quarter, accumulated VAT, reserve and relevant warnings', async () => {
    const html = renderToStaticMarkup(await QuarterlyVatForecast())
    expect(html).toContain('T4 2026')
    expect(html).toContain('16/11/2026')
    expect(html).toContain('IVA facturado')
    expect(html).toContain('Saldo acumulado')
    expect(html).toContain('Previsión a reservar')
    expect(html).toContain('300,00')
    expect(html).toContain('otra moneda')
    expect(html).toContain('rectificativas')
    expect(html).toContain('gestoría')
    expect(html).not.toContain('sin IVA válido')
  })
})
