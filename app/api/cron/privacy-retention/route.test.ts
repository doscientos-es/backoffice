import { beforeEach, describe, expect, it, vi } from 'vitest'

const { anonymizeExpiredLeadPii, processDuePrivacyErasures, serverEnv } = vi.hoisted(() => ({
  anonymizeExpiredLeadPii: vi.fn(),
  processDuePrivacyErasures: vi.fn(),
  serverEnv: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ serverEnv }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('@/lib/privacy/service', () => ({ anonymizeExpiredLeadPii, processDuePrivacyErasures }))

import { GET } from './route'

function request(token?: string): Request {
  return new Request('https://backoffice.test/api/cron/privacy-retention', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('GET /api/cron/privacy-retention', () => {
  beforeEach(() => {
    serverEnv.mockReturnValue({ CRON_SECRET: 'cron-secret' })
    processDuePrivacyErasures.mockResolvedValue({ completed: 1, blocked: 1, failed: 0 })
    anonymizeExpiredLeadPii.mockResolvedValue({ anonymized: 2, blocked: 0 })
  })

  it('fails closed without the configured cron secret', async () => {
    const response = await GET(request() as never)
    expect(response.status).toBe(401)
    expect(processDuePrivacyErasures).not.toHaveBeenCalled()
  })

  it('processes one bounded due batch', async () => {
    const response = await GET(request('cron-secret') as never)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      completed: 1,
      blocked: 1,
      failed: 0,
      leadRetention: { anonymized: 2, blocked: 0 },
    })
  })
})