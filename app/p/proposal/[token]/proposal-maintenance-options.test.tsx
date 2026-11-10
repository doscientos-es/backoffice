import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

import { ProposalMaintenanceOptions } from './proposal-maintenance-options'

describe('ProposalMaintenanceOptions', () => {
  it('shows informative alternatives and the recommendation without selection controls', () => {
    render(<ProposalMaintenanceOptions offer={DEFAULT_MAINTENANCE_OFFER} />)

    expect(screen.getByRole('heading', { name: 'Opciones de mantenimiento' })).toBeDefined()
    const growthPlan = screen.getByRole('heading', { name: 'Crecimiento' }).closest('article')
    expect(within(growthPlan!).getByText('Recomendado')).toBeDefined()
    expect(screen.getAllByText('Incluye')).toHaveLength(DEFAULT_MAINTENANCE_OFFER.plans.length)
    expect(screen.getAllByText('No incluye')).toHaveLength(DEFAULT_MAINTENANCE_OFFER.plans.length)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByText('Seleccionado')).toBeNull()
    expect(screen.getByText(/no están incluidas en el importe/)).toBeDefined()
  })

  it.each([1, 2, 3])('renders exactly %i options and the configured recommendation', (count) => {
    const plans = DEFAULT_MAINTENANCE_OFFER.plans.slice(0, count)
    render(
      <ProposalMaintenanceOptions
        offer={{ ...DEFAULT_MAINTENANCE_OFFER, plans, recommended_plan_id: plans[0]!.id }}
      />,
    )
    expect(screen.getAllByRole('article')).toHaveLength(count)
    const recommended = screen.getByRole('heading', { name: plans[0]!.name }).closest('article')
    expect(within(recommended!).getByText('Recomendado')).toBeDefined()
    expect(screen.getAllByText('Recomendado')).toHaveLength(1)
  })

  it.each([
    ['ca', 'Opcions de manteniment', 'Recomanat'],
    ['en', 'Maintenance options', 'Recommended'],
  ] as const)('shows informative copy in %s', (language, heading, recommended) => {
    render(<ProposalMaintenanceOptions offer={DEFAULT_MAINTENANCE_OFFER} language={language} />)
    expect(screen.getByRole('heading', { name: heading })).toBeDefined()
    expect(screen.getByText(recommended)).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
