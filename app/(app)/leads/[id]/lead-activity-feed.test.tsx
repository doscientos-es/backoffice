import { render, screen, within } from '@testing-library/react'
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
  auditEvents: [],
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

  it('keeps same-day call times and orders recent calls after the intake email', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'))
    render(
      <LeadActivityFeed
        {...props}
        interactions={[
          {
            id: 'earlier-call',
            type: 'call',
            subject: 'Primer intento',
            body: null,
            created_at: '2026-11-03T09:00:00.000Z',
            performer: null,
            payload: { call_date: '2026-11-03', outcome: 'no_answer' },
            resend_email_id: null,
          },
          {
            id: 'intake-email',
            type: 'email_sent',
            subject: 'Solicitud recibida',
            body: null,
            created_at: '2026-11-03T07:00:00.000Z',
            performer: null,
            payload: {},
            resend_email_id: null,
          },
          {
            id: 'latest-call',
            type: 'call',
            subject: 'Segundo intento',
            body: null,
            created_at: '2026-11-03T09:50:00.000Z',
            performer: null,
            payload: { call_date: '2026-11-03', outcome: 'no_answer' },
            resend_email_id: null,
          },
        ]}
        auditEvents={[
          {
            id: 'audit-1',
            entityType: 'leads',
            occurredAt: '2026-11-03T09:24:00.000Z',
            actorId: null,
            actorName: null,
            action: 'update',
            changedFields: ['estimated_value'],
            origin: 'system',
          },
        ]}
      />,
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows[0]?.textContent).toContain('Segundo intento')
    expect(within(rows[0] as HTMLElement).getByText('hace 10 minutos')).toBeDefined()
    expect(rows[1]?.textContent).toContain('Ficha actualizada')
    expect(rows[2]?.textContent).toContain('Primer intento')
    expect(within(rows[2] as HTMLElement).getByText('hace 1 hora')).toBeDefined()
    expect(rows[3]?.textContent).toContain('Solicitud recibida')
    expect(within(rows[3] as HTMLElement).getByText('hace 3 horas')).toBeDefined()
    expect(screen.getByText('Última hace 10 minutos')).toBeDefined()
    expect(screen.queryByText('hace 10 horas')).toBeNull()
  })

  it('warns when a call is missing notes or its result, but not when both are recorded', () => {
    render(
      <LeadActivityFeed
        {...props}
        interactions={[
          {
            id: 'missing-notes',
            type: 'call',
            subject: 'Llamada sin notas',
            body: null,
            created_at: '2026-08-26T10:00:00.000Z',
            performer: null,
            payload: { outcome: 'connected' },
            resend_email_id: null,
          },
          {
            id: 'missing-outcome',
            type: 'call',
            subject: 'Llamada sin resultado',
            body: 'Enviar propuesta.',
            created_at: '2026-08-26T09:00:00.000Z',
            performer: null,
            payload: {},
            resend_email_id: null,
          },
          {
            id: 'complete',
            type: 'call',
            subject: 'Llamada completa',
            body: 'Propuesta enviada.',
            created_at: '2026-08-26T08:00:00.000Z',
            performer: null,
            payload: { outcome: 'connected' },
            resend_email_id: null,
          },
        ]}
      />,
    )

    expect(screen.getByText('Faltan las notas de la llamada.')).toBeDefined()
    expect(screen.getByText('Falta el resultado de la llamada.')).toBeDefined()
    expect(screen.getAllByRole('status')).toHaveLength(2)
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

  it('shows audit changes in chronological order without exposing changed values', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T12:00:00.000Z'))
    render(
      <LeadActivityFeed
        {...props}
        auditEvents={[
          {
            id: 'audit-1',
            entityType: 'leads',
            occurredAt: '2026-10-09T10:00:00.000Z',
            actorId: 'member-1',
            actorName: 'Aina',
            action: 'update',
            changedFields: ['estimated_value'],
            origin: 'backoffice',
          },
        ]}
        interactions={[
          {
            id: 'note-1',
            type: 'note',
            subject: 'Llamada posterior',
            body: null,
            created_at: '2026-10-09T11:00:00.000Z',
            performer: null,
            payload: {},
            resend_email_id: null,
          },
        ]}
      />,
    )

    expect(screen.getByText('Ficha actualizada')).toBeDefined()
    expect(screen.getByText('valor estimado')).toBeDefined()
    expect(screen.getByText('Por Aina')).toBeDefined()
    expect(screen.queryByText(/1200|valor anterior/)).toBeNull()
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]?.textContent).toContain('Llamada posterior')
    expect(rows[1]?.textContent).toContain('Ficha actualizada')
  })
})
