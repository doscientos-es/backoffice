import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => {
  let value: string | undefined
  const store = {
    get: vi.fn(() => (value ? { value } : undefined)),
    set: vi.fn((_: string, next: string) => {
      value = next
    }),
    delete: vi.fn(() => {
      value = undefined
    }),
  }
  return { state: { store, clear: () => (value = undefined) } }
})

vi.mock('next/headers', () => ({ cookies: async () => state.store }))
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: 'test-key' }) }))

import {
  TRUSTED_MFA_DEVICE_MAX_AGE_SECONDS,
  grantTrustedMfaDevice,
  hasTrustedMfaDevice,
  revokeTrustedMfaDevice,
} from './trusted-mfa-device'

describe('trusted MFA device', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'))
    state.clear()
    state.store.set.mockClear()
    state.store.delete.mockClear()
  })

  afterEach(() => vi.useRealTimers())

  it('trusts only the verified user for 12 hours', async () => {
    await grantTrustedMfaDevice('user-a')

    await expect(hasTrustedMfaDevice('user-a')).resolves.toBe(true)
    await expect(hasTrustedMfaDevice('user-b')).resolves.toBe(false)
    expect(state.store.set).toHaveBeenCalledWith(
      'trusted_mfa_device',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        maxAge: TRUSTED_MFA_DEVICE_MAX_AGE_SECONDS,
        sameSite: 'strict',
      }),
    )
  })

  it('expires after 12 hours and is removed on sign-out', async () => {
    await grantTrustedMfaDevice('user-a')
    vi.advanceTimersByTime(TRUSTED_MFA_DEVICE_MAX_AGE_SECONDS * 1000 + 1)
    await expect(hasTrustedMfaDevice('user-a')).resolves.toBe(false)

    await revokeTrustedMfaDevice()
    await expect(hasTrustedMfaDevice('user-a')).resolves.toBe(false)
    expect(state.store.delete).toHaveBeenCalledWith('trusted_mfa_device')
  })
})