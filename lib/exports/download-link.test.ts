import { beforeEach, describe, expect, it, vi } from 'vitest'

const { serverEnv } = vi.hoisted(() => ({ serverEnv: vi.fn() }))
vi.mock('@/lib/env', () => ({
  serverEnv,
}))

import { createExportDownloadSignature, isValidExportDownloadSignature } from './download-link'

describe('export download links', () => {
  const input = {
    userId: 'member-1',
    format: 'csv' as const,
    table: 'leads',
    includePii: false,
    expiresAt: 1_800_000_000,
  }

  beforeEach(() => {
    serverEnv.mockReturnValue({ PORTAL_COOKIE_SECRET: 'test-export-signing-secret' })
  })

  it('only accepts an unmodified, user-bound export scope', () => {
    const signature = createExportDownloadSignature(input)
    expect(isValidExportDownloadSignature(input, signature)).toBe(true)
    expect(isValidExportDownloadSignature({ ...input, includePii: true }, signature)).toBe(false)
    expect(isValidExportDownloadSignature({ ...input, userId: 'member-2' }, signature)).toBe(false)
  })
})