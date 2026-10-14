import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildCommercialPerformance } from '@/lib/leads/commercial-performance'

import { CommercialPerformancePanel } from './commercial-performance-panel'

const performance = buildCommercialPerformance({
  leads: [],
  proposals: [],
  interactions: [],
  reminders: [],
  members: [],
  since: '2026-08-01',
  until: '2026-08-31',
  now: new Date('2026-08-31'),
})
afterEach(() => vi.restoreAllMocks())

describe('CommercialPerformancePanel', () => {
  it('explains sample sizes, cohorts and pending operations without inventing averages', () => {
    render(
      <CommercialPerformancePanel
        performance={performance}
        canSeePrices={false}
        since="2026-08-01"
        until="2026-08-31"
      />,
    )
    expect(screen.getByRole('region', { name: 'Rendimiento comercial' })).toBeDefined()
    expect(screen.getByText('Entrega de propuesta')).toBeDefined()
    expect(screen.getByText('Muestras válidas')).toBeDefined()
    expect(screen.getByText('Sin fechas / inválidas')).toBeDefined()
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0)
    expect(screen.queryByText('Valor aceptado · con IVA')).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Revisar pendientes +72 h' }).getAttribute('href'),
    ).toBe('/proposals?followup=waiting_72')
  })
  it('exports aggregate metrics with methodology rather than raw customer records', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:metrics')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(
      <CommercialPerformancePanel
        performance={performance}
        canSeePrices={false}
        since="2026-08-01"
        until="2026-08-31"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Exportar métricas JSON' }))
    expect(create).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
  })
})
