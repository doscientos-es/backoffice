import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateDueSubscriptionInvoices, serverEnv, updateSubscriptionsByCpi } = vi.hoisted(() => ({
  generateDueSubscriptionInvoices: vi.fn(),
  serverEnv: vi.fn(),
  updateSubscriptionsByCpi: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ serverEnv }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('@/lib/subscriptions/generate-invoices', () => ({ generateDueSubscriptionInvoices }))
vi.mock('@/lib/subscriptions/update-cpi', () => ({ updateSubscriptionsByCpi }))

import { GET } from './route'

function request(token?: string): Request {
  return new Request('https://backoffice.test/api/cron/subscription-invoices', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('GET /api/cron/subscription-invoices', () => {
  beforeEach(() => {
    serverEnv.mockReturnValue({ CRON_SECRET: 'cron-secret' })
    updateSubscriptionsByCpi.mockResolvedValue({
      status: 'skipped',
      adjustmentYear: 2026,
      rate: null,
      subscriptionsUpdated: 0,
    })
    generateDueSubscriptionInvoices.mockResolvedValue({ checked: 1, generated: [], failures: [] })
  })

  it('rejects calls without the cron secret', async () => {
    const response = await GET(request() as never)
    expect(response.status).toBe(401)
    expect(updateSubscriptionsByCpi).not.toHaveBeenCalled()
    expect(generateDueSubscriptionInvoices).not.toHaveBeenCalled()
  })

  it('updates CPI before generating invoices and returns both summaries', async () => {
    updateSubscriptionsByCpi.mockResolvedValue({
      status: 'applied',
      adjustmentYear: 2027,
      rate: 2.9,
      subscriptionsUpdated: 3,
    })

    const response = await GET(request('cron-secret') as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      checked: 1,
      generated: [],
      failures: [],
      cpi: {
        status: 'applied',
        adjustmentYear: 2027,
        rate: 2.9,
        subscriptionsUpdated: 3,
      },
    })
    expect(updateSubscriptionsByCpi).toHaveBeenCalledBefore(generateDueSubscriptionInvoices)
  })

  it('does not generate invoices when the CPI step fails', async () => {
    updateSubscriptionsByCpi.mockRejectedValue(new Error('INE unavailable'))

    const response = await GET(request('cron-secret') as never)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'subscription_invoice_generation_failed',
    })
    expect(generateDueSubscriptionInvoices).not.toHaveBeenCalled()
  })
})