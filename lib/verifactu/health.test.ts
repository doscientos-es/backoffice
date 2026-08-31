import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, getVerifactuDiagnosticGate, serverEnv } = vi.hoisted(() => ({
  from: vi.fn(),
  getVerifactuDiagnosticGate: vi.fn(),
  serverEnv: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ serverEnv }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ from }),
}))
vi.mock('./diagnostics', () => ({ getVerifactuDiagnosticGate }))

import { getCertificateHealth, getVerifactuOperationalHealth } from './health'

const NOW = new Date('2026-08-22T12:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  serverEnv.mockReturnValue({ VERIFACTU_CERT_EXPIRES_AT: '2026-09-10T12:00:00.000Z' })
  getVerifactuDiagnosticGate.mockResolvedValue({
    status: 'passed',
    ranAt: '2026-08-22T10:00:00.000Z',
    expiresAt: '2026-08-29T10:00:00.000Z',
  })
})

describe('getCertificateHealth', () => {
  it('warns during the 30 days before certificate expiry', () => {
    expect(getCertificateHealth('2026-09-10T12:00:00.000Z', NOW)).toMatchObject({
      status: 'warning',
      daysRemaining: 19,
    })
  })

  it('reports expired and missing certificate metadata', () => {
    expect(getCertificateHealth('2026-08-21T12:00:00.000Z', NOW).status).toBe('expired')
    expect(getCertificateHealth('2026-08-22T11:00:00.000Z', NOW).status).toBe('expired')
    expect(getCertificateHealth(undefined, NOW)).toEqual({
      status: 'missing',
      expiresAt: null,
      daysRemaining: null,
    })
  })
})

describe('getVerifactuOperationalHealth', () => {
  it('summarises pending, retryable and definitive outbox states', async () => {
    const responses = [
      { count: 2, error: null },
      { count: 1, error: null },
      { count: 3, error: null },
    ]
    from.mockImplementation(() => ({
      select: () => ({
        in: async () => responses.shift(),
        eq: async () => responses.shift(),
      }),
    }))

    await expect(getVerifactuOperationalHealth()).resolves.toMatchObject({
      queueAvailable: true,
      pending: 2,
      retrying: 1,
      blocked: 3,
      diagnostic: { status: 'passed' },
      certificate: { status: 'warning' },
    })
  })
})
