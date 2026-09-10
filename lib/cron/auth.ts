import { timingSafeEqual } from 'node:crypto'

type RequestWithHeaders = {
  headers: Pick<Headers, 'get'>
}

function matchesToken(candidate: string, secret: string): boolean {
  const candidateBuffer = Buffer.from(candidate)
  const secretBuffer = Buffer.from(secret)
  return (
    candidateBuffer.length === secretBuffer.length && timingSafeEqual(candidateBuffer, secretBuffer)
  )
}

/**
 * Authorizes a scheduled/internal request against one or more configured
 * secrets. An absent secret list deliberately denies access: cron endpoints
 * must never become public because an environment variable was omitted.
 */
export function isAuthorizedCronRequest(
  request: RequestWithHeaders,
  allowedSecrets: readonly (string | null | undefined)[],
): boolean {
  const authorization = request.headers.get('authorization') ?? ''
  const candidate = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : authorization
  if (!candidate) return false

  return allowedSecrets
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => matchesToken(candidate, secret))
}