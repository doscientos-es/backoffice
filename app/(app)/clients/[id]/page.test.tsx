import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  role: 'owner',
  originLead: { id: 'lead-1', name: 'Empresa', company: null } as {
    id: string
    name: string
    company: string | null
  } | null,
}))
vi.mock('@/lib/auth', () => ({ requireUser: async () => ({ role: state.role }) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
  notFound: () => {
    throw new Error('not found')
  },
}))
vi.mock('@/lib/members/queries', () => ({ listActiveMembers: async () => [] }))
vi.mock('@/lib/clients/queries', () => ({
  getClientDetail: async () => ({
    client: { id: 'client-1', name: 'Empresa', version: 1 },
    originLead: state.originLead,
    projects: [],
    proposals: [],
    invoices: [],
    tasks: [],
    reminders: [],
  }),
}))

import ClientDetailPage from './page'

describe('legacy fiscal detail links', () => {
  beforeEach(() => {
    state.role = 'owner'
    state.originLead = { id: 'lead-1', name: 'Empresa', company: null }
  })

  it('redirects a visible linked lead to its unified detail', async () => {
    await expect(ClientDetailPage({ params: Promise.resolve({ id: 'client-1' }) })).rejects.toThrow(
      'redirect:/leads/lead-1',
    )
  })

  it('keeps the fiscal detail for finance and for unavailable leads', async () => {
    state.role = 'accountant'
    await expect(
      ClientDetailPage({ params: Promise.resolve({ id: 'client-1' }) }),
    ).resolves.toBeDefined()
    state.role = 'owner'
    state.originLead = null
    await expect(
      ClientDetailPage({ params: Promise.resolve({ id: 'client-1' }) }),
    ).resolves.toBeDefined()
  })
})
