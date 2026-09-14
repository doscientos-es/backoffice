import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'

import { serverEnv } from '@/lib/env'

export const TRUSTED_MFA_DEVICE_MAX_AGE_SECONDS = 12 * 60 * 60
const TRUSTED_MFA_DEVICE_COOKIE = 'trusted_mfa_device'

type TrustedMfaDeviceGrant = {
  userId: string
  expiresAt: number
}

function sign(value: string): string {
  return createHmac('sha256', serverEnv().SUPABASE_SERVICE_ROLE_KEY)
    .update(`trusted-mfa-device:${value}`)
    .digest('base64url')
}

function encode(grant: TrustedMfaDeviceGrant): string {
  const value = Buffer.from(JSON.stringify(grant)).toString('base64url')
  return `${value}.${sign(value)}`
}

function decode(cookieValue: string | undefined): TrustedMfaDeviceGrant | null {
  if (!cookieValue) return null
  const [value, signature] = cookieValue.split('.')
  if (!value || !signature) return null

  const expected = Buffer.from(sign(value))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

  try {
    const grant = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as TrustedMfaDeviceGrant
    if (!grant.userId || !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt <= Date.now()) {
      return null
    }
    return grant
  } catch {
    return null
  }
}

/** Trust this browser for a short period after the current session completed MFA. */
export async function grantTrustedMfaDevice(userId: string): Promise<void> {
  const store = await cookies()
  const grant: TrustedMfaDeviceGrant = {
    userId,
    expiresAt: Date.now() + TRUSTED_MFA_DEVICE_MAX_AGE_SECONDS * 1000,
  }
  store.set(TRUSTED_MFA_DEVICE_COOKIE, encode(grant), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TRUSTED_MFA_DEVICE_MAX_AGE_SECONDS,
  })
}

/** Returns whether this browser is still trusted for the authenticated user. */
export async function hasTrustedMfaDevice(userId: string): Promise<boolean> {
  const store = await cookies()
  return decode(store.get(TRUSTED_MFA_DEVICE_COOKIE)?.value)?.userId === userId
}

/** Revoke the current browser's MFA trust, including on explicit sign-out. */
export async function revokeTrustedMfaDevice(): Promise<void> {
  const store = await cookies()
  store.delete(TRUSTED_MFA_DEVICE_COOKIE)
}