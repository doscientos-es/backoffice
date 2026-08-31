const DEFAULT_EMAIL_APP_URL = 'https://app.doscientos.es'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'])

/**
 * Returns the public base URL for links and tracking assets rendered in email.
 * Local development URLs are never useful to email recipients, so fall back to
 * the canonical production application URL instead.
 */
export function emailAppUrl(appUrl: string | null | undefined): string {
  const candidate = appUrl?.trim()
  if (!candidate) return DEFAULT_EMAIL_APP_URL

  try {
    const url = new URL(candidate)
    if (LOCAL_HOSTNAMES.has(url.hostname)) return DEFAULT_EMAIL_APP_URL
    return candidate.replace(/\/+$/, '')
  } catch {
    return DEFAULT_EMAIL_APP_URL
  }
}
