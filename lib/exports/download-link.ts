import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { serverEnv } from '@/lib/env'

export const EXPORT_LINK_TTL_SECONDS = 5 * 60

export type ExportDownloadInput = {
  userId: string
  format: 'json' | 'csv'
  table: string | null
  includePii: boolean
  expiresAt: number
}

function signingSecret(): string {
  const env = serverEnv()
  return env.PORTAL_COOKIE_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY
}

function payload(input: ExportDownloadInput): string {
  return [input.userId, input.format, input.table ?? '', input.includePii ? '1' : '0', input.expiresAt].join(':')
}

export function createExportDownloadSignature(input: ExportDownloadInput): string {
  return createHmac('sha256', signingSecret()).update(payload(input)).digest('base64url')
}

export function isValidExportDownloadSignature(input: ExportDownloadInput, signature: string): boolean {
  const expected = Buffer.from(createExportDownloadSignature(input))
  const candidate = Buffer.from(signature)
  return expected.length === candidate.length && timingSafeEqual(expected, candidate)
}