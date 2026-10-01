import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mfa } = vi.hoisted(() => ({
  mfa: {
    listFactors: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}))

const { trustCurrentMfaDevice, trustCurrentMfaDeviceAfterPasskey } = vi.hoisted(() => ({
  trustCurrentMfaDevice: vi.fn(),
  trustCurrentMfaDeviceAfterPasskey: vi.fn(),
}))
const { verifyWithPasskey } = vi.hoisted(() => ({ verifyWithPasskey: vi.fn() }))

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({ auth: { mfa } }),
}))
vi.mock('@/lib/security/mfa-actions', () => ({
  trustCurrentMfaDevice,
  trustCurrentMfaDeviceAfterPasskey,
}))
vi.mock('./use-passkey-verification', () => ({
  usePasskeyVerification: () => ({ challenge: null, verifyWithPasskey }),
}))

import { MfaChallengeDialog } from './mfa-challenge-dialog'

describe('MfaChallengeDialog', () => {
  beforeEach(() => {
    mfa.listFactors.mockReset().mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      error: null,
    })
    mfa.challengeAndVerify.mockReset().mockResolvedValue({ error: null })
    trustCurrentMfaDevice.mockReset().mockResolvedValue({ ok: true })
    trustCurrentMfaDeviceAfterPasskey.mockReset().mockResolvedValue({ ok: true })
    verifyWithPasskey.mockReset().mockResolvedValue({ ok: true })
  })

  it('submits a normalized six-digit code from the shared OTP input', async () => {
    const onVerified = vi.fn()
    render(<MfaChallengeDialog open onOpenChange={vi.fn()} onVerified={onVerified} />)
    const input = await screen.findByRole('textbox', { name: /código de verificación/i })
    await waitFor(() => expect(input).toHaveProperty('disabled', false))

    fireEvent.change(input, { target: { value: '12a3 45-6' } })
    fireEvent.click(screen.getByRole('button', { name: /verificar y continuar/i }))

    await waitFor(() => {
      expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
        factorId: 'factor-1',
        code: '123456',
      })
      expect(trustCurrentMfaDevice).toHaveBeenCalledOnce()
      expect(onVerified).toHaveBeenCalledOnce()
    })
  })

  it('allows verifying the session with the configured device biometric', async () => {
    const onVerified = vi.fn()
    mfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null })
    render(
      <MfaChallengeDialog
        open
        onOpenChange={vi.fn()}
        onVerified={onVerified}
        passkeyScope={{ intent: 'admin.mfa', resource: 'current-session' }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: /usar biometría/i }))

    await waitFor(() => {
      expect(verifyWithPasskey).toHaveBeenCalledWith({
        intent: 'admin.mfa',
        resource: 'current-session',
      })
      expect(trustCurrentMfaDeviceAfterPasskey).toHaveBeenCalledOnce()
      expect(onVerified).toHaveBeenCalledOnce()
    })
  })
})
