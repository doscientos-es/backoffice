'use server'

import { hasAal2Session, hasMfaAccess, requireUser } from '@/lib/auth'

import { grantTrustedMfaDevice, revokeTrustedMfaDevice } from './trusted-mfa-device'
import { hasRecentUserVerification } from './user-verification'

type Result = { ok: true } | { ok: false; error: string }

/** Marks the current browser as trusted after Supabase confirms an AAL2 session. */
export async function trustCurrentMfaDevice(): Promise<Result> {
  try {
    const user = await requireUser()
    if (!(await hasAal2Session())) {
      return { ok: false, error: 'No se ha podido confirmar la verificación MFA.' }
    }
    await grantTrustedMfaDevice(user.id)
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se ha podido recordar este dispositivo.' }
  }
}

/** Trusts the current browser after a server-validated WebAuthn verification. */
export async function trustCurrentMfaDeviceAfterPasskey(): Promise<Result> {
  try {
    const user = await requireUser()
    if (!(await hasRecentUserVerification(user.id))) {
      return { ok: false, error: 'No se ha podido confirmar la verificación biométrica.' }
    }
    await grantTrustedMfaDevice(user.id)
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se ha podido recordar este dispositivo.' }
  }
}

/** Lets the client-side gate honor a server-validated trusted-device cookie. */
export async function hasCurrentMfaAccess(): Promise<boolean> {
  const user = await requireUser()
  return hasMfaAccess(user.id)
}

/** Clears the device-trust cookie before ending the Supabase session. */
export async function clearTrustedMfaDevice(): Promise<void> {
  await revokeTrustedMfaDevice()
}
