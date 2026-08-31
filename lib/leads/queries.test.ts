import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  tasks: [] as Record<string, unknown>[],
  campaigns: [] as Record<string, unknown>[],
  leadSelect: '',
  inCalls: [] as [string, unknown[]][],
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const result = {
        data:
          table === 'leads'
            ? state.rows
            : table === 'tasks'
              ? state.tasks
              : table === 'marketing_campaigns'
                ? state.campaigns
                : [],
        error: null,
        count: table === 'leads' ? state.rows.length : null,
      }
      // `then` makes the builder awaitable for chains that don't end in
      // `limit()` (the next-action query ends in `order()`).
      const builder = {
        select(selection: string) {
          if (table === 'leads') state.leadSelect = selection
          return builder
        },
        eq: () => builder,
        is: () => builder,
        order: () => builder,
        in: (column: string, values: unknown[]) => {
          if (table === 'leads') state.inCalls.push([column, values])
          return builder
        },
        limit: async () => result,
        // biome-ignore lint/suspicious/noThenProperty: mock needs to be thenable to mimic Supabase query builder
        then: (resolve: (value: typeof result) => unknown) => resolve(result),
      }
      return builder
    },
  }),
}))

import { listLeads } from './queries'

describe('listLeads client avatar enrichment', () => {
  beforeEach(() => {
    state.rows = []
    state.tasks = []
    state.campaigns = []
    state.leadSelect = ''
    state.inCalls = []
  })

  it('maps the linked client logo and keeps unconverted leads without a client', async () => {
    state.rows = [
      {
        id: 'lead-1',
        name: 'María García',
        status: 'new',
        created_at: '2026-07-16T10:00:00.000Z',
        updated_at: '2026-07-16T10:00:00.000Z',
        client: [{ name: 'Acme SL', logo_url: 'https://cdn.example/acme.png' }],
      },
      {
        id: 'lead-2',
        name: 'Jorge Pérez',
        status: 'new',
        created_at: '2026-07-15T10:00:00.000Z',
        updated_at: '2026-07-15T10:00:00.000Z',
        client: [],
      },
    ]

    const result = await listLeads({
      view: 'board',
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(state.leadSelect).toContain('client:clients!lead_id(name, logo_url)')
    expect(result.leads[0]?.client).toEqual({
      name: 'Acme SL',
      logo_url: 'https://cdn.example/acme.png',
    })
    expect(result.leads[1]?.client).toBeNull()
  })

  it('attaches the soonest pending reminder as the lead next action', async () => {
    state.rows = [
      {
        id: 'lead-1',
        name: 'María García',
        status: 'contacted',
        created_at: '2026-07-16T10:00:00.000Z',
        updated_at: '2026-07-16T10:00:00.000Z',
        client: [],
      },
      {
        id: 'lead-2',
        name: 'Jorge Pérez',
        status: 'contacted',
        created_at: '2026-07-15T10:00:00.000Z',
        updated_at: '2026-07-15T10:00:00.000Z',
        client: [],
      },
    ]
    // Ordered ascending by the query: only the first reminder per lead counts.
    state.tasks = [
      {
        id: 'task-1',
        lead_id: 'lead-1',
        title: 'Enviar email',
        start_at: '2026-07-20T09:00:00.000Z',
        action_type: 'email',
      },
      {
        id: 'task-2',
        lead_id: 'lead-1',
        title: 'Reunión',
        start_at: '2099-07-22T09:00:00.000Z',
        action_type: 'meeting',
      },
    ]

    const result = await listLeads({
      view: 'board',
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(result.leads[0]?.next_action).toEqual({
      id: 'task-1',
      title: 'Enviar email',
      remind_at: '2026-07-20T09:00:00.000Z',
      action_type: 'email',
    })
    expect(result.leads[0]?.scheduled_meeting_at).toBe('2099-07-22T09:00:00.000Z')
    expect(result.leads[1]?.next_action).toBeNull()
  })

  it('resolves a Meta lead campaign name from the synced campaign catalog', async () => {
    state.rows = [
      {
        id: 'lead-1',
        name: 'María García',
        status: 'new',
        created_at: '2026-07-16T10:00:00.000Z',
        updated_at: '2026-07-16T10:00:00.000Z',
        utm_campaign: 'campaign-cya',
      },
    ]
    state.campaigns = [{ id: 'campaign-cya', name: 'CYA - PROSP SOFTWARE' }]

    const result = await listLeads({
      view: 'board',
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(state.leadSelect).toContain('utm_campaign')
    expect(result.leads[0]?.marketing_campaign_name).toBe('CYA - PROSP SOFTWARE')
  })

  it('limits a notification summary view to its lead ids', async () => {
    await listLeads({
      view: 'board',
      ids: ['lead-1', 'lead-2'],
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(state.inCalls).toContainEqual(['id', ['lead-1', 'lead-2']])
  })
})
