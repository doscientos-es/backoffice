import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  lead: 'ca' as string | null,
  clientLead: 'en' as string | null,
  selection: '',
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({ ok: true, user: { id: 'team-1' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: (selection: string) => {
          if (table === 'proposals') state.selection = selection
          return chain
        },
        eq: () => chain,
        is: () => chain,
        order: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({
          data: {
            id: 'proposal-1',
            status: 'draft',
            title: 'Example',
            leads: { language: state.lead },
            clients: { leads: { language: state.clientLead } },
          },
          error: null,
        }),
      }
      return chain
    },
  }),
}))

describe('public deck language', () => {
  beforeEach(() => {
    state.lead = 'ca'
    state.clientLead = 'en'
    state.selection = ''
  })

  it('honours an explicit language and falls back to the proposal or client lead', async () => {
    const { default: DeckPage } = await import('./page')
    const page = (lang?: string) =>
      DeckPage({
        params: Promise.resolve({ token: 'example' }),
        searchParams: Promise.resolve({ lang }),
      })
    expect((await page('en')).props.language).toBe('en')
    expect((await page()).props.language).toBe('ca')
    state.lead = null
    expect((await page('invalid')).props.language).toBe('en')
    state.clientLead = null
    expect((await page()).props.language).toBe('es')
    expect(state.selection).toContain('leads(language)')
  })
})
