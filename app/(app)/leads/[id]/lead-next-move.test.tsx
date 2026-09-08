import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeadNextMove } from './lead-next-move'

const props = {
  leadId: 'lead-1',
  leadStatus: 'quoted',
  firstContactedAt: '2026-08-01T10:00:00.000Z',
  phone: '600111222',
  interactions: [],
  proposals: [],
  projects: [],
  invoices: [],
}

describe('LeadNextMove', () => {
  afterEach(() => vi.useRealTimers())

  it('directs a draft proposal to its existing context instead of creating another one', () => {
    render(
      <LeadNextMove
        {...props}
        proposals={[
          {
            id: 'proposal-draft',
            number: null,
            title: 'Automatización comercial',
            status: 'draft',
            total: null,
            valid_until: null,
            sent_at: null,
            viewed_at: null,
            responded_at: null,
            notes: null,
          },
        ]}
      />,
    )

    expect(screen.getByText('Completar y enviar la propuesta')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Abrir propuesta' }).getAttribute('href')).toBe(
      '/proposals/proposal-draft',
    )
  })

  it('recognizes an accepted proposal as a delivery step', () => {
    render(
      <LeadNextMove
        {...props}
        proposals={[
          {
            id: 'proposal-accepted',
            number: 'P-2026-001',
            title: 'Automatización comercial',
            status: 'accepted',
            total: 1000,
            valid_until: null,
            sent_at: '2026-08-01T10:00:00.000Z',
            viewed_at: null,
            responded_at: '2026-08-02T10:00:00.000Z',
            notes: null,
          },
        ]}
      />,
    )

    expect(screen.getByText('Preparar la entrega acordada')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Abrir propuesta' }).getAttribute('href')).toBe(
      '/proposals/proposal-accepted',
    )
  })

  it('prioritizes an overdue reminder with a direct follow-up CTA', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'))
    render(
      <LeadNextMove
        {...props}
        reminders={[
          { id: 'reminder-1', title: 'Llamar para cerrar', remind_at: '2026-08-25T09:00:00.000Z' },
        ]}
      />,
    )

    expect(screen.getByText('Resolver seguimiento vencido')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Registrar llamada' }).getAttribute('href')).toBe(
      '/leads/lead-1?feedback=call',
    )
  })
})
