import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ proposal: {} as Record<string, unknown>, unlocked: false }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => ({ ok: false })) }))
vi.mock('@/lib/portal/access', () => ({ isPortalUnlocked: vi.fn(async () => state.unlocked) }))
vi.mock('@/lib/env', () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: 'https://example.test' } }))
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
}))
vi.mock('./actions', () => ({ unlockProposalPortal: vi.fn(), trackPortalEngagement: vi.fn() }))
vi.mock('./_lib/track-view', () => ({ trackProposalView: vi.fn() }))
vi.mock('./_lib/load-proposal-data', () => ({
  loadProposalData: vi.fn(async () => ({
    items: [],
    specs: [],
    settings: null,
    payments: [],
    depositInvoice: null,
    contact: null,
    team: [],
  })),
}))

import { PortalPasswordGate } from '@/components/portal/password-gate'

import { DecisionBrief } from './_components/decision-brief'
import { loadProposalData } from './_lib/load-proposal-data'
import PortalProposalPage from './page'

const input = {
  params: Promise.resolve({ token: 'example-token' }),
  searchParams: Promise.resolve({ view: 'summary', lang: 'en' }),
}

describe('summary portal access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.proposal = {
      id: 'example',
      status: 'sent',
      title: 'Example',
      is_client_visible: true,
      portal_password_hash: 'hash',
    }
    state.unlocked = false
  })

  it('blocks draft and hidden proposals before loading their content', async () => {
    state.proposal.status = 'draft'
    await expect(PortalProposalPage(input)).rejects.toThrow('NOT_FOUND')
    state.proposal.status = 'sent'
    state.proposal.is_client_visible = false
    await expect(PortalProposalPage(input)).rejects.toThrow('NOT_FOUND')
    expect(loadProposalData).not.toHaveBeenCalled()
  })

  it('requires the same password gate before returning the summary', async () => {
    const locked = await PortalProposalPage(input)
    expect(locked.type).toBe(PortalPasswordGate)
    expect(loadProposalData).not.toHaveBeenCalled()
    state.unlocked = true
    const unlocked = await PortalProposalPage(input)
    expect(unlocked.type).toBe(DecisionBrief)
    expect(unlocked.props.language).toBe('en')
    expect(loadProposalData).toHaveBeenCalledOnce()
  })
})
