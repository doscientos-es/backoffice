import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeadActivityFeed } from './lead-activity-feed'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ sendEmailToLead: vi.fn() }))

const props = {
  leadId: 'lead-1',
  leadEmail: 'lead@example.com',
  canEdit: true,
  aiEnabled: false,
  interactions: [],
  proposals: [],
  invoices: [],
  tasks: [],
}

describe('LeadActivityFeed', () => {
  afterEach(() => vi.useRealTimers())

  it('shows one email event with its accumulated Resend statuses', () => {
    render(
      <LeadActivityFeed
        {...props}
        interactions={[
          {
            id: 'delivered',
            type: 'email_delivered',
            subject: 'Email entregado por Resend · Hola',
            body: null,
            created_at: '2026-08-26T10:01:00.000Z',
            performer: null,
            payload: {},
            resend_email_id: 'email-1',
          },
          {
            id: 'sent',
            type: 'email_sent',
            subject: 'Hola',
            body: '<p>Contenido</p>',
            created_at: '2026-08-26T10:00:00.000Z',
            performer: null,
            payload: {},
            resend_email_id: 'email-1',
          },
        ]}
      />,
    )

    expect(screen.getAllByText('Email enviado')).toHaveLength(1)
    expect(screen.getByText('Enviado')).toBeDefined()
    expect(screen.getByText('Entregado')).toBeDefined()
  })

  it('groups events under clear day headings', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'))
    render(
      <LeadActivityFeed
        {...props}
        interactions={[
          {
            id: 'today',
            type: 'note',
            subject: 'Información relevante',
            body: null,
            created_at: '2026-08-26T10:00:00.000Z',
            performer: null,
            payload: {},
            resend_email_id: null,
          },
          {
            id: 'yesterday',
            type: 'call',
            subject: 'Llamada inicial',
            body: null,
            created_at: '2026-08-25T10:00:00.000Z',
            performer: null,
            payload: {},
            resend_email_id: null,
          },
        ]}
      />,
    )

    expect(screen.getByText('Hoy')).toBeDefined()
    expect(screen.getByText('Ayer')).toBeDefined()
  })

  it('merges commercial milestones into the same chronological feed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'))
    render(
      <LeadActivityFeed
        {...props}
        invoices={[
          {
            id: 'invoice-1',
            full_number: 'F-2026-001',
            status: 'overdue',
            total: 1210,
            issue_date: '2026-08-25T00:00:00.000Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('Factura vencida')).toBeDefined()
    expect(screen.getByRole('link', { name: /F-2026-001/ }).getAttribute('href')).toBe(
      '/invoices/invoice-1',
    )
  })
})
