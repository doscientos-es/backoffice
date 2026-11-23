import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

const { fulfill, prepare } = vi.hoisted(() => ({ fulfill: vi.fn(), prepare: vi.fn() }))
const testToken = 'unit-test-credentials-not-used-anywhere-else'

vi.mock('@/lib/env', () => ({ serverEnv: () => ({ ABACO_BILLING_SECRET: testToken }) }))
vi.mock('@/lib/invoices/abaco-subscription-fulfillment', () => ({
  fulfillAbacoSubscription: fulfill,
  prepareAbacoSubscription: prepare,
}))

const payment = {
  paymentId: '1f3ca824-69ae-4eb6-8c84-89b05e308d8a',
  tenantId: '3388c456-33c0-4f11-89dc-1bc346e4bf58',
  order: '0421DEDABB39',
  paidAt: '2026-03-25T09:00:00+00:00',
  startsAt: '2026-03-25T09:00:00+00:00',
  endsAt: '2026-04-25T09:00:00+00:00',
  plan: 'team',
  interval: 'month',
  netCents: 999,
  totalCents: 1209,
  vatPercent: 21,
  recipient: {
    legal_name: 'Empresa sintética',
    tax_id: 'A00000000',
    street: 'Calle de pruebas',
    postal_code: '00000',
    city: 'Ciudad de pruebas',
    province: 'Provincia de pruebas',
    email: 'facturas@example.test',
  },
}

function post(body: unknown, token = testToken) {
  return POST(
    new Request('https://backoffice.example.test/api/integrations/abaco/billing', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  )
}

describe('Ábaco subscription integration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects callers before sending any fiscal or payment work downstream', async () => {
    expect((await post({ action: 'issue', payment }, 'wrong')).status).toBe(401)
    expect(prepare).not.toHaveBeenCalled()
    expect(fulfill).not.toHaveBeenCalled()
  })

  it.each([{ totalCents: 1208 }, { vatPercent: 0 }, { endsAt: payment.startsAt }])(
    'rejects an inconsistent event (%j) without issuing',
    async (override) => {
      expect((await post({ action: 'issue', payment: { ...payment, ...override } })).status).toBe(
        422,
      )
      expect(fulfill).not.toHaveBeenCalled()
    },
  )

  it('returns the fiscal preflight outcome without issuing anything', async () => {
    prepare.mockResolvedValue('fiscal_identity_invalid')
    const response = await post({
      action: 'prepare',
      tenantId: payment.tenantId,
      recipient: payment.recipient,
    })
    expect(await response.json()).toEqual({ status: 'fiscal_identity_invalid' })
    expect(fulfill).not.toHaveBeenCalled()
  })

  it('accepts a confirmed charge with cent rounding and lets the worker retry independently', async () => {
    fulfill.mockResolvedValue({ status: 'fiscal_pending' })
    const response = await post({ action: 'issue', payment })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'fiscal_pending' })
    expect(fulfill).toHaveBeenCalledWith(payment)
  })

  it('accepts subscription invoices for the standard plan', async () => {
    fulfill.mockResolvedValue({ status: 'fiscal_pending' })
    const standard = { ...payment, plan: 'standard' }
    const response = await post({ action: 'issue', payment: standard })
    expect(response.status).toBe(200)
    expect(fulfill).toHaveBeenCalledWith(standard)
  })

  it.each([
    { netCents: 983, totalCents: 1189, discountCents: 21 },
    { netCents: 0, totalCents: 0, discountCents: 1210 },
  ])('accepts consistent referral discounts, including a free invoice', async (amounts) => {
    fulfill.mockResolvedValue({ status: 'fiscal_pending' })
    const discounted = {
      ...payment,
      netCents: amounts.netCents,
      totalCents: amounts.totalCents,
      referralDiscount: { originalNetCents: 1000, discountCents: amounts.discountCents },
    }
    expect((await post({ action: 'issue', payment: discounted })).status).toBe(200)
    expect(fulfill).toHaveBeenCalledWith(discounted)
  })

  it.each([
    { netCents: 0, totalCents: 0 },
    { netCents: 0, totalCents: 0, referralDiscount: { originalNetCents: 1000, discountCents: 1 } },
    {
      netCents: 999,
      totalCents: 1209,
      referralDiscount: { originalNetCents: 999, discountCents: 1 },
    },
  ])('rejects invalid free or discounted invoices (%j)', async (override) => {
    expect((await post({ action: 'issue', payment: { ...payment, ...override } })).status).toBe(422)
    expect(fulfill).not.toHaveBeenCalled()
  })
})
