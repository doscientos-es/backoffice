import { describe, expect, it } from 'vitest'

import { buildInvoiceTimeline } from './invoice-timeline'

describe('buildInvoiceTimeline', () => {
  it('combines invoice milestones and sorts newest first', () => {
    const events = buildInvoiceTimeline({
      issueDate: '2026-09-01T09:00:00.000Z',
      deliveries: [
        {
          id: 'delivery-1',
          channel: 'email',
          recipient: 'client@example.com',
          attached_pdf: true,
          mocked: false,
          created_at: '2026-09-01T10:00:00.000Z',
          sent_by_name: 'Ana',
        },
      ],
      payments: [
        {
          id: 'payment-1',
          amount: 200,
          status: 'confirmed',
          created_at: '2026-09-03T10:00:00.000Z',
          confirmed_at: '2026-09-03T10:01:00.000Z',
        },
      ],
      automation: {
        id: 'automation-1',
        status: 'pending',
        run_at: '2026-09-05T09:00:00.000Z',
        sent_at: null,
        cancelled_at: null,
      },
    })

    expect(events.map((event) => event.label)).toEqual([
      'Seguimiento automático programado',
      'Cobro confirmado',
      'Factura enviada por email',
      'Factura emitida',
    ])
  })

  it('does not invent an event for empty invoice history', () => {
    expect(
      buildInvoiceTimeline({ issueDate: null, deliveries: [], payments: [], automation: null }),
    ).toEqual([])
  })
})
