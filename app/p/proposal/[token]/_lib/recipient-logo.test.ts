import { describe, expect, it, vi } from 'vitest'

import type { createAdminClient } from '@/lib/supabase/admin'

import { resolveRecipientLogo } from './recipient-logo'

function adminFor(data: { logo_url: string | null } | null, error: object | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error })
  const is = vi.fn().mockReturnValue({ maybeSingle })
  const eq = vi.fn().mockReturnValue({ is })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { admin: { from } as unknown as ReturnType<typeof createAdminClient>, from, eq, is }
}

describe('resolveRecipientLogo', () => {
  it('uses the logo already loaded for a client without querying again', async () => {
    const { admin, from } = adminFor(null)
    expect(await resolveRecipientLogo(admin, 'https://example.test/logo.png', null)).toBe(
      'https://example.test/logo.png',
    )
    expect(from).not.toHaveBeenCalled()
  })

  it('finds the active linked client for a lead-first proposal', async () => {
    const { admin, eq, is } = adminFor({ logo_url: 'https://example.test/logo.png' })
    expect(await resolveRecipientLogo(admin, null, 'lead-1')).toBe('https://example.test/logo.png')
    expect(eq).toHaveBeenCalledWith('lead_id', 'lead-1')
    expect(is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('does not use an ambiguous or failed lookup', async () => {
    const { admin } = adminFor(null, { message: 'multiple rows' })
    expect(await resolveRecipientLogo(admin, null, 'lead-1')).toBeNull()
  })
})
