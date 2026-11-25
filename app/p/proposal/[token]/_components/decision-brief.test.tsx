import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { computeProposalTotals } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'
import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

import type { ProposalItem } from '../_lib/types'
import { DecisionBrief } from './decision-brief'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
afterEach(() => {
  cleanup()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  if (originalShare) Object.defineProperty(navigator, 'share', originalShare)
  else Reflect.deleteProperty(navigator, 'share')
})

const items: ProposalItem[] = [
  {
    id: '1',
    description: 'Desarrollo',
    quantity: 1,
    unit_price: 1000,
    vat_rate: 21,
    subtotal: 1000,
    billing_cycle: 'none',
    discount_percent: 20,
  },
  {
    id: '2',
    description: 'Servicio mensual',
    quantity: 1,
    unit_price: 100,
    vat_rate: 21,
    subtotal: 100,
    billing_cycle: 'monthly',
    discount_percent: 20,
  },
  {
    id: '3',
    description: 'Servicio anual',
    quantity: 1,
    unit_price: 600,
    vat_rate: 21,
    subtotal: 600,
    billing_cycle: 'yearly',
  },
]
const props = {
  token: 'example-token',
  language: 'es' as const,
  title: 'Proyecto de prueba',
  number: 'P-1',
  recipient: 'Cliente de prueba',
  statusLabel: 'Pendiente',
  validUntil: null,
  totals: computeProposalTotals(items, { type: 'percent', value: 10 }),
  items,
  scopeModules: [{ id: '1', title: 'Plataforma', included: [], excluded: [] }],
  solutions: [],
  maintenanceOffer: DEFAULT_MAINTENANCE_OFFER,
  canRespond: true,
  isDraft: false,
}

describe('DecisionBrief', () => {
  it('separates discounted initial investment, recurring charges and optional plans', () => {
    render(<DecisionBrief {...props} />)
    const money = (amount: number) => formatPortalEUR(amount, 'es').replace(/\s/g, ' ')
    expect(screen.getByText('Plataforma')).toBeDefined()
    expect(screen.getByText('Inversión').nextElementSibling?.textContent).toContain(
      formatPortalEUR(720, 'es'),
    )
    expect(screen.getByText(`${money(871.2)} con IVA`)).toBeDefined()
    expect(screen.getByText(`Mensual: ${money(80)} sin IVA`)).toBeDefined()
    expect(screen.getByText(`Anual: ${money(600)} sin IVA`)).toBeDefined()
    expect(screen.getByText('No incluidas en la inversión inicial.')).toBeDefined()
    expect(screen.getByText(`Esencial: ${money(80)} / mes sin IVA`)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Ver propuesta completa' }).getAttribute('href')).toBe(
      '/p/proposal/example-token?lang=es',
    )
  })

  it('does not invent recurring charges or expose draft sharing actions', () => {
    render(
      <DecisionBrief
        {...props}
        isDraft
        canRespond={false}
        items={[]}
        totals={computeProposalTotals([])}
        scopeModules={[]}
        maintenanceOffer={{ ...DEFAULT_MAINTENANCE_OFFER, enabled: false }}
      />,
    )
    expect(
      screen.getByText('No hay cuotas recurrentes en las partidas de la propuesta.'),
    ).toBeDefined()
    expect(screen.queryByText('Opciones de mantenimiento')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Compartir' })).toBeNull()
    expect(screen.queryByText(/acéptala/)).toBeNull()
    expect(screen.getByText('Borrador: solo visible para el equipo.')).toBeDefined()
  })

  it('copies the summary link and prepares an email with the same URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Reflect.deleteProperty(navigator, 'share')
    render(<DecisionBrief {...props} language="ca" />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))
    const url = `${window.location.origin}/p/proposal/example-token?view=summary&lang=ca`
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url))
    expect(screen.getByRole('status').textContent).toBe('Enllaç copiat.')
    expect(
      decodeURIComponent(
        screen.getByRole('link', { name: 'Enviar per correu' }).getAttribute('href')!,
      ),
    ).toContain(url)
  })
})
