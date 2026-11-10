import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_MAINTENANCE_OFFER,
  MAINTENANCE_LIMITS,
  type MaintenanceOffer,
  maintenanceOfferInput,
} from '@/lib/proposals/maintenance'

import { MaintenanceOfferEditor } from './maintenance-offer-editor'

function EditableOffer({ onChange }: { onChange: (offer: MaintenanceOffer) => void }) {
  const [offer, setOffer] = useState(DEFAULT_MAINTENANCE_OFFER)
  return (
    <MaintenanceOfferEditor
      offer={offer}
      onChange={(next) => {
        setOffer(next)
        onChange(next)
      }}
      locked={false}
    />
  )
}

describe('MaintenanceOfferEditor', () => {
  it('uses the default maintenance heading', () => {
    render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        onChange={vi.fn()}
        locked={false}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Mantenimiento' })).toBeDefined()
    expect(screen.queryByText('Mantenimiento opcional')).toBeNull()
  })

  it('keeps multiline edits until blur and imports pasted bullet lists', () => {
    const onChange = vi.fn()
    render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        onChange={onChange}
        locked={false}
      />,
    )

    const exclusions = screen.getByLabelText('Exclusiones del plan Esencial')
    fireEvent.change(exclusions, {
      target: { value: '- Cambios de contenido\n• Nuevas integraciones\n3. Formación' },
    })
    expect((exclusions as HTMLTextAreaElement).value).toContain('\n• Nuevas integraciones')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(exclusions)

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plans: expect.arrayContaining([
          expect.objectContaining({
            id: 'essential',
            exclusions: ['Cambios de contenido', 'Nuevas integraciones', 'Formación'],
          }),
        ]),
      }),
    )
  })

  it('lets the team choose the plan recommended to the client', () => {
    const onChange = vi.fn()
    render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        onChange={onChange}
        locked={false}
      />,
    )

    fireEvent.click(screen.getByLabelText('Recomendar el plan Esencial'))

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ recommended_plan_id: 'essential' }),
    )
  })

  it('disables maintenance for a punctual proposal', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        onChange={onChange}
        locked={false}
      />,
    )

    fireEvent.click(screen.getByLabelText('Incluir mantenimiento en esta propuesta'))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
    rerender(
      <MaintenanceOfferEditor
        offer={{ ...DEFAULT_MAINTENANCE_OFFER, enabled: false }}
        onChange={onChange}
        locked={false}
      />,
    )
    expect(screen.queryByLabelText('Título de mantenimiento')).toBeNull()
  })

  it('starts with three plans, supports two or one, and repairs a removed recommendation', () => {
    const onChange = vi.fn()
    render(<EditableOffer onChange={onChange} />)
    expect(screen.getAllByRole('button', { name: /Eliminar el plan/ })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /Seleccionar/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el plan Crecimiento' }))
    const twoPlans = onChange.mock.lastCall![0]
    expect(twoPlans.plans).toHaveLength(2)
    expect(twoPlans.recommended_plan_id).toBe('essential')
    expect(maintenanceOfferInput.safeParse(twoPlans).success).toBe(true)
    expect((screen.getByLabelText('Recomendar el plan Esencial') as HTMLInputElement).checked).toBe(
      true,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el plan Evolución' }))
    const onePlan = onChange.mock.lastCall![0]
    expect(onePlan.plans).toHaveLength(1)
    expect(maintenanceOfferInput.safeParse(onePlan).success).toBe(true)
    const remove = screen.getByRole('button', { name: 'Eliminar el plan Esencial' })
    expect((remove as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(remove)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('adds independent editable plans up to the supported limit', () => {
    const onChange = vi.fn()
    render(<EditableOffer onChange={onChange} />)
    const add = screen.getByRole('button', { name: 'Añadir plan' })
    for (let count = 3; count < MAINTENANCE_LIMITS.maxPlans; count++) fireEvent.click(add)
    const offer = onChange.mock.lastCall![0] as MaintenanceOffer
    expect(offer.plans).toHaveLength(MAINTENANCE_LIMITS.maxPlans)
    expect(new Set(offer.plans.map((plan) => plan.id)).size).toBe(MAINTENANCE_LIMITS.maxPlans)
    expect(offer.recommended_plan_id).toBe('growth')
    expect((add as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Nombre del plan 4'), { target: { value: 'A medida' } })
    expect(onChange.mock.lastCall![0].plans[3].name).toBe('A medida')
    expect(DEFAULT_MAINTENANCE_OFFER.plans).toHaveLength(3)
  })

  it('prevents adding, removing or recommending plans when locked', () => {
    const onChange = vi.fn()
    render(<MaintenanceOfferEditor offer={DEFAULT_MAINTENANCE_OFFER} onChange={onChange} locked />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el plan Esencial' }))
    expect(
      (screen.getByLabelText('Recomendar el plan Esencial') as HTMLInputElement).disabled,
    ).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
  })
})
