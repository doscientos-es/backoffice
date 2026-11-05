import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  results: [] as Array<{ data?: unknown; error?: unknown }>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  send: vi.fn(),
  marketingKey: '',
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {}
      const resolve = () => ({ data: null, error: null, ...state.results.shift() })
      for (const method of [
        'select',
        'eq',
        'lte',
        'limit',
        'not',
        'is',
        'update',
        'order',
        'upsert',
        'insert',
      ]) {
        builder[method] = (...args: unknown[]) => {
          state.calls.push({ table, method, args })
          return builder
        }
      }
      builder.maybeSingle = async () => resolve()
      builder.single = async () => resolve()
      builder.range = async (...args: unknown[]) => {
        state.calls.push({ table, method: 'range', args })
        return resolve()
      }
      builder.then = (callback: (value: unknown) => unknown) =>
        Promise.resolve(resolve()).then(callback)
      return builder
    },
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }))
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({
    RESEND_API_KEY: 'fake-test-key',
    EMAIL_MARKETING_RESEND_API_KEY: state.marketingKey,
    EMAIL_MARKETING_FROM_EMAIL: 'hello@example.test',
    EMAIL_MARKETING_FROM_NAME: 'Test',
    EMAIL_MARKETING_REPLY_TO: 'hello@example.test',
  }),
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://example.test' },
}))
vi.mock('@/lib/email/resend', () => ({ sendEmail: state.send }))

import { processDueEmailMarketing } from './email-marketing'

const queued = {
  id: 'send-1',
  campaign_id: 'campaign-1',
  lead_id: null,
  email: 'ana@example.test',
  tracking_token: '123e4567-e89b-42d3-a456-426614174000',
  marketing_contact_id: 'contact-1',
  sequence_step_id: 'step-1',
  marketing_contact: { name: 'Ana', company: null, status: 'subscribed' },
  step: {
    id: 'step-1',
    title: 'Paso',
    subject: 'Hola',
    preview_text: null,
    body_markdown: 'Hola',
    sequence: { name: 'Secuencia', status: 'active' },
  },
}

beforeEach(() => {
  state.results = []
  state.calls = []
  state.send.mockReset()
  state.marketingKey = ''
})

describe('bajas en la cola de marketing', () => {
  it('omite un envío si el contacto se dio de baja tras cargar la cola', async () => {
    state.results = [
      { data: [] },
      { data: [queued] },
      { data: { id: 'send-1' } },
      { data: { status: 'unsubscribed' } },
      {},
      { data: [] },
    ]
    expect(await processDueEmailMarketing()).toMatchObject({ skipped: 1, sent: 0 })
    expect(state.send).not.toHaveBeenCalled()
    expect(state.calls).toContainEqual({
      table: 'lead_campaign_sends',
      method: 'update',
      args: [{ marketing_send_status: 'skipped' }],
    })
  })

  it('no envía si falla la comprobación del contacto', async () => {
    state.results = [
      { data: [] },
      { data: [queued] },
      { data: { id: 'send-1' } },
      { error: { message: 'failure' } },
      {},
      { data: [] },
    ]
    expect(await processDueEmailMarketing()).toMatchObject({ failed: 1, sent: 0 })
    expect(state.send).not.toHaveBeenCalled()
  })

  it('incluye enlace directo y cabeceras de baja en envíos válidos', async () => {
    state.send.mockResolvedValue({ id: 'provider-id', mocked: false })
    state.results = [
      { data: [] },
      { data: [queued] },
      { data: { id: 'send-1' } },
      { data: { status: 'subscribed' } },
      {},
      { data: [] },
    ]
    expect(await processDueEmailMarketing()).toMatchObject({ sent: 1, failed: 0 })
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAlias: 'hello@example.test',
        replyTo: 'hello@example.test',
        apiKey: 'fake-test-key',
        html: expect.stringContaining(
          `https://example.test/api/track/unsubscribe/${queued.tracking_token}`,
        ),
        headers: {
          'List-Unsubscribe': `<https://example.test/api/track/unsubscribe/${queued.tracking_token}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    )
  })

  it('prioriza la cuenta dedicada de marketing si está configurada', async () => {
    state.marketingKey = 'fake-marketing-key'
    state.send.mockResolvedValue({ id: 'provider-id', mocked: false })
    state.results = [
      { data: [] },
      { data: [queued] },
      { data: { id: 'send-1' } },
      { data: { status: 'subscribed' } },
      {},
      { data: [] },
    ]
    expect(await processDueEmailMarketing()).toMatchObject({ sent: 1, failed: 0 })
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'fake-marketing-key', fromAlias: 'hello@example.test' }),
    )
  })

  it('personaliza asunto, vista previa y mensaje con los datos del destinatario', async () => {
    state.send.mockResolvedValue({ id: 'provider-id', mocked: false })
    state.results = [
      { data: [] },
      {
        data: [
          {
            ...queued,
            marketing_contact: { name: '<Ana>', company: 'Acme', status: 'subscribed' },
            step: {
              ...queued.step,
              subject: 'Hola {{nombre}}',
              preview_text: 'Para {{empresa}}',
              body_markdown: 'Hola {{nombre}} · {{email}}',
            },
          },
        ],
      },
      { data: { id: 'send-1' } },
      { data: { status: 'subscribed' } },
      {},
      { data: [] },
    ]
    expect(await processDueEmailMarketing()).toMatchObject({ sent: 1 })
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Hola <Ana>',
        html: expect.stringContaining('Hola &lt;Ana&gt; · ana@example.test'),
      }),
    )
    expect(state.send.mock.calls[0]?.[0].html).toContain('Para Acme')
  })

  it('restringe el procesamiento inmediato al correo elegido', async () => {
    state.results = [{ data: [] }, { data: [] }, { data: [] }]
    await processDueEmailMarketing({ stepId: 'step-1' })
    expect(state.calls).toContainEqual({
      table: 'email_marketing_sequence_steps',
      method: 'eq',
      args: ['id', 'step-1'],
    })
    expect(state.calls).toContainEqual({
      table: 'lead_campaign_sends',
      method: 'eq',
      args: ['sequence_step_id', 'step-1'],
    })
    expect(state.calls).toContainEqual({
      table: 'lead_campaign_sends',
      method: 'not',
      args: ['step.tracking_campaign_id', 'is', null],
    })
  })

  it('prepara todos los contactos aunque la lista supere una página de Supabase', async () => {
    const members = Array.from({ length: 1001 }, (_, i) => ({
      contact: {
        id: `contact-${i}`,
        email: `p${i}@example.test`,
        name: null,
        company: null,
        lead_id: null,
        status: 'subscribed',
      },
    }))
    state.results = [
      {
        data: [
          {
            id: 'step-1',
            title: 'Paso',
            subject: 'Hola',
            body_markdown: 'Hola',
            sequence: { name: 'Secuencia', list_id: 'list-1', status: 'active' },
          },
        ],
      },
      { data: { id: 'step-1' } },
      { data: { id: 'campaign-1' } },
      { data: members.slice(0, 1000) },
      { data: members.slice(1000) },
      {},
      {},
      {},
      {},
      {},
      {},
      { data: [] },
      { data: [] },
    ]
    expect(await processDueEmailMarketing({ stepId: 'step-1' })).toMatchObject({ prepared: 1001 })
    const calls = state.calls.filter(
      (call) => call.table === 'lead_campaign_sends' && call.method === 'insert',
    )
    expect(calls).toHaveLength(5)
    expect(calls[4]?.args[0] as unknown[]).toHaveLength(1)
    const lastInsert = state.calls.lastIndexOf(calls[4]!)
    const link = state.calls.findIndex(
      (call) =>
        call.table === 'email_marketing_sequence_steps' &&
        call.method === 'update' &&
        (call.args[0] as { tracking_campaign_id?: string }).tracking_campaign_id === 'campaign-1',
    )
    expect(link).toBeGreaterThan(lastInsert)
    expect(state.calls).toContainEqual({
      table: 'email_marketing_list_members',
      method: 'range',
      args: [1000, 1999],
    })
  })

  it('no publica ni envía una campaña si falla la preparación de destinatarios', async () => {
    state.results = [
      {
        data: [
          {
            id: 'step-1',
            title: 'Paso',
            subject: 'Hola',
            body_markdown: 'Hola',
            sequence: { name: 'Secuencia', list_id: 'list-1', status: 'active' },
          },
        ],
      },
      { data: { id: 'step-1' } },
      { data: { id: 'campaign-1' } },
      {
        data: [
          {
            contact: {
              id: 'contact-1',
              email: 'ana@example.test',
              name: null,
              company: null,
              lead_id: null,
              status: 'subscribed',
            },
          },
        ],
      },
      { error: { message: 'queue error' } },
      {},
      { data: [] },
      { data: [] },
    ]
    expect(await processDueEmailMarketing({ stepId: 'step-1' })).toMatchObject({
      failed: 1,
      sent: 0,
    })
    expect(state.send).not.toHaveBeenCalled()
    expect(state.calls).not.toContainEqual({
      table: 'email_marketing_sequence_steps',
      method: 'update',
      args: [{ tracking_campaign_id: 'campaign-1' }],
    })
    expect(state.calls).toContainEqual({
      table: 'email_marketing_sequence_steps',
      method: 'update',
      args: [{ status: 'failed', last_error: 'queue error' }],
    })
  })
})
