import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ rows: [] as unknown[], history: new Map() }))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'order']) query[method] = () => query
      query.maybeSingle = async () => ({ data: { id: 'step-1' }, error: null })
      query.range = async (start: number, end: number) => ({
        data: state.rows.slice(start, end + 1),
        error: null,
      })
      if (table !== 'lead_campaign_sends' && table !== 'email_marketing_sequence_steps')
        throw new Error('unexpected table')
      return query
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ authorizedHistory: true }) }))
vi.mock('./resend-events', () => ({ getResendActivity: vi.fn(async () => state.history) }))

import { getEmailMarketingStepDetails } from './email-marketing'
import { getResendActivity } from './resend-events'

beforeEach(() => {
  state.rows = Array.from({ length: 52 }, (_, index) => ({
    id: `send-${index}`,
    email: `person-${index}@example.test`,
    resend_email_id: `mail-${index}`,
    marketing_send_status: 'sent',
    sent_at: '2026-01-01T10:00:00Z',
    delivered_at: '2026-01-01T10:00:00Z',
    opened_at: null,
    clicked_at: null,
    click_count: 0,
    unsubscribed_at: null,
    bounced_at: null,
    complained_at: null,
    converted_lead_id: null,
    contact: null,
  }))
  state.history = new Map([
    [
      'mail-0',
      {
        openedAt: '2026-01-02T10:00:00Z',
        clickedAt: '2026-01-02T11:00:00Z',
        links: ['https://example.test/page'],
      },
    ],
  ])
  vi.mocked(getResendActivity).mockClear()
})

describe('actividad de destinatarios', () => {
  it('combina historial autorizado, métricas y filtros antes de paginar', async () => {
    const clicked = await getEmailMarketingStepDetails('step-1', 1, 'clicked')
    expect(clicked?.metrics).toMatchObject({ sent: 52, delivered: 52, opened: 1, clicked: 1 })
    expect(clicked?.total).toBe(1)
    expect(clicked?.recipients[0]).toMatchObject({
      email: 'person-0@example.test',
      links: ['https://example.test/page'],
    })
    expect(getResendActivity).toHaveBeenCalledWith(
      { authorizedHistory: true },
      expect.arrayContaining(['mail-0', 'mail-51']),
    )
    const notOpened = await getEmailMarketingStepDetails('step-1', 2, 'not_opened')
    expect(notOpened?.total).toBe(51)
    expect(notOpened?.recipients).toHaveLength(1)
    expect(notOpened?.recipients[0]?.email).toBe('person-51@example.test')
  })
})
