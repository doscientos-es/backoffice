import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AbacoSubscriptionPayment } from './abaco-subscription-event'
import { fulfillAbacoSubscription } from './abaco-subscription-fulfillment'

const { rpc, send, single } = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), single: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/components/email', () => ({ InvoiceEmail: (props: unknown) => props }))
vi.mock('@/lib/clients/fiscal-verification', () => ({}))
vi.mock('@/lib/email/render', () => ({ renderEmail: async () => '<p>Factura pagada</p>' }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: send }))
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ ABACO_BILLING_PORTAL_URL: 'https://invoices.example.test' }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ is: () => ({ single }) }) }) }),
  }),
}))
vi.mock('@/lib/verifactu/config', () => ({ verifactuSoftwareSnapshotFromEnv: () => ({}) }))
vi.mock('@/lib/verifactu/outbox', () => ({ assertDurableVerifactuPackage: async () => {} }))

const payment: AbacoSubscriptionPayment = {
  paymentId: 'a0d7e0d7-83b1-4e70-8545-924f4b41c662',
  tenantId: 'aa3efa8a-b10e-4ab6-9b5d-595338b6c644',
  order: '1234TEST',
  paidAt: '2026-05-01T12:00:00.000Z',
  startsAt: '2026-05-01T12:00:00.000Z',
  endsAt: '2026-06-01T12:00:00.000Z',
  plan: 'solo',
  interval: 'month',
  netCents: 1000,
  totalCents: 1210,
  vatPercent: 21,
  recipient: {
    legal_name: 'Destinatario sintético',
    tax_id: 'A00000000',
    street: 'Calle de pruebas',
    postal_code: '00000',
    city: 'Ciudad de pruebas',
    province: 'Provincia de pruebas',
    email: 'facturas@example.test',
  },
}

function fiscalState(state: string, finishFails = false) {
  rpc.mockImplementation(async (name: string) => {
    if (name === 'issue_abaco_subscription_invoice') return { data: 'fixed-invoice-id' }
    if (name === 'begin_abaco_invoice_email') return { data: state }
    if (name === 'finish_abaco_invoice_email') return { error: finishFails }
    throw new Error(`Unexpected RPC ${name}`)
  })
}

describe('fulfillAbacoSubscription', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    single.mockResolvedValue({
      data: {
        full_number: 'TEST-001',
        portal_token: 'synthetic',
        status: 'paid',
        is_client_visible: true,
      },
    })
  })

  it.each(['fiscal_pending', 'fiscal_review'])(
    'does not release the invoice when %s',
    async (state) => {
      fiscalState(state)
      expect(await fulfillAbacoSubscription(payment)).toEqual({ status: state })
      expect(send).not.toHaveBeenCalled()
    },
  )

  it('reuses the provider key if Resend accepted but recording the delivery failed', async () => {
    send.mockResolvedValue({ id: 'same-provider-id', mocked: false })
    fiscalState('send', true)
    expect(await fulfillAbacoSubscription(payment)).toMatchObject({ status: 'email_pending' })
    fiscalState('send')
    expect(await fulfillAbacoSubscription(payment)).toMatchObject({ status: 'sent' })
    expect(send.mock.calls.map(([email]) => email.idempotencyKey)).toEqual([
      `abaco-subscription/${payment.paymentId}`,
      `abaco-subscription/${payment.paymentId}`,
    ])
    fiscalState('sent')
    expect(await fulfillAbacoSubscription(payment)).toMatchObject({ status: 'sent' })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('does not send again once the provider idempotency period becomes uncertain', async () => {
    fiscalState('review')
    expect(await fulfillAbacoSubscription(payment)).toMatchObject({ status: 'email_review' })
    expect(send).not.toHaveBeenCalled()
  })
})
