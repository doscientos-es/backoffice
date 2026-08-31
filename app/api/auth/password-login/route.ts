import { createHmac } from 'node:crypto'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { publicEnv, serverEnv } from '@/lib/env'
import { distributedRateLimit } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WINDOW_SECONDS = 15 * 60
const MAX_ATTEMPTS_PER_IP = 15
const CAPTCHA_AFTER_ATTEMPTS = 3
const loginInput = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1024),
  captchaToken: z.string().min(1).max(4096).optional(),
})

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/** Avoid retaining an email address in the distributed rate-limit table. */
function accountKey(email: string): string {
  return createHmac('sha256', serverEnv().SUPABASE_SERVICE_ROLE_KEY)
    .update(email.toLowerCase())
    .digest('base64url')
}

function errorResponse(
  error: 'captcha_required' | 'invalid_credentials' | 'rate_limited',
  status: number,
) {
  return NextResponse.json(
    { error, captchaRequired: error === 'captcha_required' },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * Password login is brokered here so that rate limiting applies before GoTrue
 * verifies credentials. Google OAuth retains its provider-managed flow.
 */
export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null)
  const parsed = loginInput.safeParse(raw)
  if (!parsed.success) return errorResponse('invalid_credentials', 400)

  const ip = clientIp(request)
  const account = accountKey(parsed.data.email)
  const [ipLimit, ipCaptchaLimit, accountCaptchaLimit] = await Promise.all([
    distributedRateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_SECONDS),
    distributedRateLimit(`login:captcha-ip:${ip}`, CAPTCHA_AFTER_ATTEMPTS, WINDOW_SECONDS),
    distributedRateLimit(
      `login:captcha-account:${account}`,
      CAPTCHA_AFTER_ATTEMPTS,
      WINDOW_SECONDS,
    ),
  ])

  if (!ipLimit.success) return errorResponse('rate_limited', 429)

  const captchaRequired =
    Boolean(publicEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY) &&
    (!ipCaptchaLimit.success || !accountCaptchaLimit.success)
  if (captchaRequired && !parsed.data.captchaToken) return errorResponse('captcha_required', 403)

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: parsed.data.captchaToken },
  })
  if (error) return errorResponse('invalid_credentials', 401)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
