import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ proposal: {} as Record<string, unknown>, unlocked: false }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => ({ ok: false })) }))
vi.mock('@/lib/portal/access', () => ({ isPortalUnlocked: vi.fn(async () => state.unlocked) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        maybeSingle: async () => ({ data: state.proposal, error: null }),
      }
      return query
    },
  }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`)
  },
}))

import DeckPage, { generateMetadata } from './page'

const input = {
  params: Promise.resolve({ token: 'token' }),
  searchParams: Promise.resolve({ lang: 'en' }),
}

describe('deck access', () => {
  beforeEach(() => {
    state.proposal = {
      status: 'sent',
      title: 'Confidential title',
      is_client_visible: true,
      portal_password_hash: 'hash',
    }
    state.unlocked = false
  })

  it('does not expose a hidden proposal', async () => {
    state.proposal.is_client_visible = false
    await expect(DeckPage(input)).rejects.toThrow('NOT_FOUND')
    expect((await generateMetadata(input)).title).not.toContain('Confidential')
  })

  it('requires the portal password before showing the deck or its metadata', async () => {
    await expect(DeckPage(input)).rejects.toThrow('REDIRECT:/p/proposal/token?lang=en')
    expect((await generateMetadata(input)).title).not.toContain('Confidential')
    state.unlocked = true
    expect((await generateMetadata(input)).title).toContain('Proposal')
    expect((await generateMetadata(input)).description).toBe('Confidential title')
  })
})
