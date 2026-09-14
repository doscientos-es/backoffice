import { beforeEach, describe, expect, it, vi } from 'vitest'

const { assurance, hasTrustedMfaDevice } = vi.hoisted(() => ({
  assurance: vi.fn(),
  hasTrustedMfaDevice: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'access-token' } } }),
      mfa: { getAuthenticatorAssuranceLevel: assurance },
    },
  }),
}))
vi.mock('@/lib/security/trusted-mfa-device', () => ({ hasTrustedMfaDevice }))

import { hasMfaAccess } from './auth'

describe('administrative MFA access', () => {
  beforeEach(() => {
    assurance.mockReset().mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null })
    hasTrustedMfaDevice.mockReset().mockResolvedValue(false)
  })

  it('allows a current Supabase AAL2 session without consulting device trust', async () => {
    assurance.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null })

    await expect(hasMfaAccess('user-a')).resolves.toBe(true)
    expect(hasTrustedMfaDevice).not.toHaveBeenCalled()
  })

  it('allows a short-lived trusted browser after a fresh AAL1 login', async () => {
    hasTrustedMfaDevice.mockResolvedValue(true)

    await expect(hasMfaAccess('user-a')).resolves.toBe(true)
    expect(hasTrustedMfaDevice).toHaveBeenCalledWith('user-a')
  })

  it('rejects an AAL1 session without a matching trusted-device grant', async () => {
    await expect(hasMfaAccess('user-a')).resolves.toBe(false)
  })
})