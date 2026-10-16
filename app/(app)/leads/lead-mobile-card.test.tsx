import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { leadFixture } from '@/tests/fixtures/leads'

vi.mock('./[id]/phone-actions', () => ({
  LeadCallLink: ({
    phone,
    leadId: _id,
    ...props
  }: ComponentProps<'a'> & { phone: string; leadId: string }) => (
    <a {...props} href={`tel:${phone.replace(/[^+0-9]/g, '')}`} />
  ),
}))

import { LeadMobileCard } from './lead-mobile-card'
import { LeadNextAction } from './lead-next-action'

describe('mobile lead cards', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('opens the quick view and keeps contact links outside the button', () => {
    const onOpen = vi.fn()
    const lead = leadFixture({ alias: 'Alias de ejemplo' })
    render(<LeadMobileCard lead={lead} onOpenAction={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir ficha rápida de Alias de ejemplo' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(screen.getByText(lead.name)).toBeTruthy()
    expect(screen.getByText(lead.company!)).toBeTruthy()
    expect(screen.getByText('Sin responsable')).toBeTruthy()
    const phone = screen.getByRole('link', { name: 'Llamar a Alias de ejemplo' })
    const email = screen.getByRole('link', { name: 'Enviar email a Alias de ejemplo' })
    expect(phone.getAttribute('href')).toBe('tel:+34600000000')
    expect(email.getAttribute('href')).toBe('mailto:contacto@example.com')
    expect(phone.closest('button')).toBeNull()
    expect(email.closest('button')).toBeNull()
    fireEvent.click(phone)
    fireEvent.click(email)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('explains missing contact details without rendering unusable links', () => {
    render(
      <LeadMobileCard lead={leadFixture({ phone: null, email: null })} onOpenAction={vi.fn()} />,
    )
    expect(screen.getByText('Sin teléfono ni email')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows a missing next action for active leads but not closed ones', () => {
    const { rerender } = render(<LeadNextAction lead={leadFixture()} />)
    expect(screen.getByText('Sin próxima acción')).toBeTruthy()
    rerender(<LeadNextAction lead={leadFixture({ status: 'won' })} />)
    expect(screen.queryByText('Sin próxima acción')).toBeNull()
  })

  it.each([
    ['2026-10-15T09:00:00.000Z', 'Vencido'],
    ['2026-10-16T10:01:00.000Z', 'Hoy'],
  ])('shows the due state and machine-readable date: %s', (remind_at, label) => {
    const { container } = render(
      <LeadNextAction
        lead={leadFixture({
          next_action: {
            id: 'action-1',
            title: 'Enviar propuesta',
            action_type: 'email',
            remind_at,
          },
        })}
      />,
    )
    expect(screen.getByText(new RegExp(label))).toBeTruthy()
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe(remind_at)
    expect(screen.getByTitle(/Enviar propuesta/).title).not.toContain('Invalid')
  })

  it('uses the booked meeting instead of an older reminder', () => {
    const { container } = render(
      <LeadNextAction
        lead={leadFixture({
          scheduled_meeting_at: '2026-10-20T10:00:00.000Z',
          next_action: {
            id: 'action-1',
            title: 'Antiguo seguimiento',
            action_type: 'email',
            remind_at: '2026-10-14T09:00:00.000Z',
          },
        })}
      />,
    )
    expect(screen.getByText(/Reunión agendada/)).toBeTruthy()
    expect(screen.queryByText(/Vencido|Antiguo seguimiento/)).toBeNull()
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe(
      '2026-10-20T10:00:00.000Z',
    )
  })

  it('shows waiting for a reply without hiding an overdue action', () => {
    const lead = leadFixture({
      recent_interactions: [
        {
          id: 'interaction-1',
          type: 'email_sent',
          subject: null,
          body: null,
          created_at: '2026-10-15T09:00:00.000Z',
          performer: null,
        },
      ],
    })
    const { rerender } = render(<LeadNextAction lead={lead} />)
    expect(screen.getByText(/Esperando respuesta/)).toBeTruthy()
    rerender(
      <LeadNextAction
        lead={{
          ...lead,
          next_action: {
            id: 'action-1',
            title: 'Seguimiento',
            action_type: 'email',
            remind_at: '2026-10-14T09:00:00.000Z',
          },
        }}
      />,
    )
    expect(screen.getByText(/Vencido/)).toBeTruthy()
    expect(screen.queryByText(/Esperando respuesta/)).toBeNull()
  })
})
