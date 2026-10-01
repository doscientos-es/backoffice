import { externalAppUrl } from '@/lib/email/app-url'
import { isAIEnabled, isGoogleEnabled, publicEnv, serverEnv } from '@/lib/env'

/**
 * Read-only snapshot of which integrations are configured, for the
 * Ajustes → Diagnóstico page.
 *
 * SAFETY: this module never returns secret values — only booleans and
 * non-sensitive scalars (domains, environment names, public URLs). Secrets
 * must never leave the server.
 */

export type SystemCheck = {
  key: string
  label: string
  configured: boolean
  /** Non-secret hint shown next to the badge (e.g. "Gemini", "modo mock"). */
  detail?: string
}

export type RuntimeInfo = { key: string; label: string; value: string }

export type SystemStatus = {
  integrations: SystemCheck[]
  runtime: RuntimeInfo[]
}

const has = (v?: string | null): boolean => Boolean(v?.trim())

export function getSystemStatus(): SystemStatus {
  const env = serverEnv()
  const resend = has(env.RESEND_API_KEY)
  const aiEnabled = isAIEnabled()

  const integrations: SystemCheck[] = [
    {
      key: 'supabase',
      label: 'Supabase',
      configured: has(publicEnv.NEXT_PUBLIC_SUPABASE_URL) && has(env.SUPABASE_SERVICE_ROLE_KEY),
    },
    {
      key: 'resend',
      label: 'Email (Resend)',
      configured: resend,
      detail: resend ? env.RESEND_FROM_DOMAIN : 'modo mock',
    },
    { key: 'google', label: 'Google Workspace', configured: isGoogleEnabled() },
    { key: 'calendar', label: 'Google Calendar', configured: has(env.GOOGLE_CALENDAR_ID) },
    {
      key: 'ai',
      label: 'IA (Gemini / Vertex)',
      configured: aiEnabled,
      detail: has(env.GEMINI_API_KEY) ? 'Gemini' : undefined,
    },
    {
      key: 'github',
      label: 'GitHub App',
      configured: has(env.GITHUB_APP_ID) && has(env.GITHUB_APP_PRIVATE_KEY_BASE64),
    },
    {
      key: 'meta',
      label: 'Meta Marketing',
      configured: has(env.META_APP_ID) && has(env.META_APP_SECRET),
    },
    {
      key: 'verifactu',
      label: 'VeriFactu',
      configured:
        has(env.VERIFACTU_PRODUCER_NIF) &&
        has(env.VERIFACTU_CERT_P12_BASE64) &&
        has(env.VERIFACTU_CERT_PASSWORD) &&
        has(env.VERIFACTU_CERT_EXPIRES_AT),
      detail: 'Diagnóstico: AEAT test · Facturación: AEAT prod',
    },
    {
      key: 'redsys',
      label: 'Redsys / Paygold',
      configured: has(env.REDSYS_MERCHANT_CODE),
      detail: env.REDSYS_ENVIRONMENT,
    },
    { key: 'lead_intake', label: 'Webhook lead-intake', configured: has(env.LEAD_INTAKE_TOKEN) },
    { key: 'backup', label: 'Backup runner', configured: has(env.BACKUP_RUNNER_URL) },
    {
      key: 'hcaptcha',
      label: 'hCaptcha',
      configured: has(publicEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY),
    },
  ]

  const runtime: RuntimeInfo[] = [
    {
      key: 'app_url',
      label: 'URL de la app',
      value: externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL),
    },
    {
      key: 'verifactu_env',
      label: 'Entornos VeriFactu',
      value: 'Diagnóstico: test · Facturación: prod',
    },
    { key: 'redsys_env', label: 'Entorno Redsys', value: env.REDSYS_ENVIRONMENT },
    { key: 'log_level', label: 'Nivel de log', value: env.LOG_LEVEL },
  ]

  return { integrations, runtime }
}
