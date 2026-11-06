import { createHmac } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { WEBHOOK_SECRET, MARKETING_SECRET, state } = vi.hoisted(() => {
  const webhookSecret = `whsec_${Buffer.from('resend-webhook-test-key').toString('base64')}`
  const marketingSecret = `whsec_${Buffer.from('marketing-webhook-test-key').toString('base64')}`
  const maybeSingle = vi.fn()
  const upsert = vi.fn()
  const is = vi.fn<() => Promise<{ error: { message: string } | null }>>(async () => ({
    error: null,
  }))
  const update = vi.fn(() => ({
    eq: () => Object.assign(Promise.resolve({ error: null }), { is }),
    ilike: (column: string, value: string) => {
      ilike(column, value)
      return { select: () => ({ maybeSingle }) }
    },
  }))
  const ilike = vi.fn()
  const from = vi.fn(() => ({
    update,
    select: () => ({
      eq: () => ({
        limit: () => ({ maybeSingle }),
        maybeSingle,
      }),
      ilike: () => ({
        is: () => ({
          limit: () => ({ maybeSingle }),
        }),
      }),
    }),
    upsert,
  }))

  return {
    WEBHOOK_SECRET: webhookSecret,
    MARKETING_SECRET: marketingSecret,
    state: { from, maybeSingle, upsert, update, is, ilike },
  }
})

vi.mock('@/lib/env', () => ({
  serverEnv: () => ({
    RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET,
    EMAIL_MARKETING_RESEND_WEBHOOK_SECRET: MARKETING_SECRET,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: state.from }),
}))

import { POST } from './route'

function signedRequest(body: string, id = 'msg_123', secret = WEBHOOK_SECRET) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64')
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')

  return new Request('http://localhost/api/email/webhook', {
    method: 'POST',
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
  }) as never
}

describe('POST /api/email/webhook', () => {
  beforeEach(() => {
    state.from.mockClear()
    state.maybeSingle
      .mockReset()
      .mockResolvedValue({ data: { lead_id: 'lead-1', client_id: null } })
    state.upsert.mockReset()
    state.upsert.mockResolvedValue({ error: null })
    state.update.mockClear()
    state.ilike.mockClear()
    state.is.mockReset().mockResolvedValue({ error: null })
  })

  it('accepts the dedicated marketing webhook secret', async () => {
    const body = JSON.stringify({ type: 'email.clicked', data: { email_id: 'email-1' } })
    expect((await POST(signedRequest(body, 'msg_marketing', MARKETING_SECRET))).status).toBe(200)
  })

  it.each(['email.sent', 'email.clicked', 'email.complained'])(
    'ignores test event %s',
    async (type) => {
      const body = JSON.stringify({
        type,
        data: { email_id: 'test-email', tags: { email_marketing_test: 'true' } },
      })
      expect((await POST(signedRequest(body))).status).toBe(200)
      expect(state.from).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['email.opened', 'opened_at'],
    ['email.clicked', 'clicked_at'],
  ])('records first %s using the event timestamp', async (type, column) => {
    const body = JSON.stringify({
      type,
      created_at: '2026-01-02T10:00:00.000Z',
      data: { email_id: 'email-1', created_at: '2026-01-01T10:00:00.000Z' },
    })
    expect((await POST(signedRequest(body))).status).toBe(200)
    expect(state.update).toHaveBeenCalledWith({ [column]: '2026-01-02T10:00:00.000Z' })
    expect(state.is).toHaveBeenCalledWith(column, null)
  })

  it('requests a retry when tracking cannot be saved', async () => {
    state.is.mockResolvedValue({ error: { message: 'database failure' } })
    const body = JSON.stringify({ type: 'email.opened', data: { email_id: 'email-1' } })
    expect((await POST(signedRequest(body))).status).toBe(500)
  })

  it.each([
    ['email.sent', 'email_sent'],
    ['email.scheduled', 'email_scheduled'],
    ['email.delivered', 'email_delivered'],
    ['email.delivery_delayed', 'email_delivery_delayed'],
    ['email.failed', 'email_failed'],
    ['email.opened', 'email_opened'],
    ['email.clicked', 'email_clicked'],
    ['email.bounced', 'email_bounced'],
    ['email.complained', 'email_complained'],
    ['email.suppressed', 'email_suppressed'],
    ['email.received', 'email_received'],
  ])('records %s as %s', async (eventType, interactionType) => {
    const body = JSON.stringify({
      type: eventType,
      data: { email_id: 'email-1', subject: 'Seguimiento' },
    })

    const response = await POST(signedRequest(body))

    expect(response.status).toBe(200)
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: 'lead-1',
        resend_email_id: 'email-1',
        resend_webhook_id: 'msg_123',
        type: interactionType,
      }),
      { ignoreDuplicates: true, onConflict: 'resend_webhook_id' },
    )
  })

  it('bloquea la dirección del envío, aunque el contacto haya cambiado de email', async () => {
    state.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'send-1', marketing_contact_id: 'contact-1', email: 'old@example.test' },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: 'old-address' }, error: null })
    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'email-1' } })
    expect((await POST(signedRequest(body))).status).toBe(200)
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'old@example.test', status: 'complained' }),
      { onConflict: 'email', ignoreDuplicates: true },
    )
    expect(state.ilike).toHaveBeenCalledWith('email', 'old@example.test')
  })

  it('solicita reintento si no puede guardar la supresión', async () => {
    state.maybeSingle.mockResolvedValueOnce({
      data: { id: 'send-1', marketing_contact_id: 'contact-1', email: 'old@example.test' },
      error: null,
    })
    state.upsert.mockResolvedValueOnce({ error: { message: 'database failure' } })
    const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'email-1' } })
    expect((await POST(signedRequest(body))).status).toBe(500)
  })

  it('links an incoming email to the lead with the matching sender address', async () => {
    state.maybeSingle
      .mockResolvedValueOnce({ data: { lead_id: null, client_id: null } })
      .mockResolvedValueOnce({ data: { id: 'lead-from-sender' }, error: null })
    const body = JSON.stringify({
      type: 'email.received',
      data: {
        email_id: 'email-incoming',
        from: 'Toni Planells <toni@example.com>',
        subject: 'Consulta',
      },
    })

    const response = await POST(signedRequest(body))

    expect(response.status).toBe(200)
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lead_id: 'lead-from-sender', type: 'email_received' }),
      expect.anything(),
    )
  })

  it('rejects an invalid signature', async () => {
    const response = await POST(
      new Request('http://localhost/api/email/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'email-1' } }),
        headers: {
          'svix-id': 'msg_123',
          'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
          'svix-signature': 'v1,invalid',
        },
      }) as never,
    )

    expect(response.status).toBe(401)
    expect(state.upsert).not.toHaveBeenCalled()
  })
})
