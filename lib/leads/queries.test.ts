import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  proposalRows: [] as Record<string, unknown>[],
  proposalPrices: [] as Record<string, unknown>[],
  proposalPriceQueries: 0,
  tasks: [] as Record<string, unknown>[],
  campaigns: [] as Record<string, unknown>[],
  ads: [] as Record<string, unknown>[],
  detailLead: null as Record<string, unknown> | null,
  detailLeadError: null as string | null,
  companyResearch: null as Record<string, unknown> | null,
  companyResearchError: null as string | null,
  auditRows: [] as Record<string, unknown>[],
  auditTimelineError: null as string | null,
  auditTimelineCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  leadSelect: '',
  leadSelections: [] as string[],
  inCalls: [] as [string, unknown[]][],
  searchFilters: [] as string[],
  leadOperations: [] as string[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    rpc: (name: string, args: Record<string, unknown>) => {
      state.auditTimelineCalls.push({ name, args })
      return Promise.resolve({
        data: state.auditRows,
        error: state.auditTimelineError ? { message: state.auditTimelineError } : null,
      })
    },
    from: (table: string) => {
      let selection = ''
      if (table === 'proposal_prices') state.proposalPriceQueries += 1
      const result = {
        data:
          table === 'leads'
            ? state.rows
            : table === 'proposals'
              ? state.proposalRows
              : table === 'proposal_prices'
                ? state.proposalPrices
                : table === 'tasks'
                  ? state.tasks
                  : table === 'marketing_campaigns'
                    ? state.campaigns
                    : table === 'marketing_ads'
                      ? state.ads
                      : [],
        error: null,
        count: table === 'leads' ? state.rows.length : null,
      }
      // `then` makes the builder awaitable for chains that don't end in
      // `limit()` (the next-action query ends in `order()`).
      const builder = {
        select(selectedColumns: string) {
          if (table === 'leads') {
            state.leadSelect = selectedColumns
            state.leadSelections.push(selectedColumns)
          }
          selection = selectedColumns
          return builder
        },
        eq: () => builder,
        is: () => builder,
        order: () => {
          if (table === 'leads') state.leadOperations.push('order')
          return builder
        },
        or: (filter: string) => {
          if (table === 'leads') {
            state.searchFilters.push(filter)
            state.leadOperations.push('search')
          }
          return builder
        },
        in: (column: string, values: unknown[]) => {
          if (table === 'leads') state.inCalls.push([column, values])
          return builder
        },
        limit: async () => result,
        range: async () => {
          if (table === 'leads') state.leadOperations.push('range')
          return result
        },
        async maybeSingle() {
          if (table === 'leads' && selection.includes('company_research')) {
            return {
              data: state.companyResearch,
              error: state.companyResearchError ? { message: state.companyResearchError } : null,
            }
          }
          if (table === 'leads') {
            return {
              data: state.detailLead,
              error: state.detailLeadError ? { message: state.detailLeadError } : null,
            }
          }
          if (table === 'marketing_ads') {
            return { data: state.ads[0] ?? null, error: null }
          }
          return { data: null, error: null }
        },
        // biome-ignore lint/suspicious/noThenProperty: mock needs to be thenable to mimic Supabase query builder
        then: (resolve: (value: typeof result) => unknown) => resolve(result),
      }
      return builder
    },
  }),
}))

import { getLeadDetail, listLeads } from './queries'

describe('listLeads client avatar enrichment', () => {
  beforeEach(() => {
    state.rows = []
    state.proposalRows = []
    state.proposalPrices = []
    state.proposalPriceQueries = 0
    state.tasks = []
    state.campaigns = []
    state.ads = []
    state.detailLead = null
    state.detailLeadError = null
    state.companyResearch = null
    state.companyResearchError = null
    state.auditRows = []
    state.auditTimelineError = null
    state.auditTimelineCalls = []
    state.leadSelect = ''
    state.leadSelections = []
    state.inCalls = []
    state.searchFilters = []
    state.leadOperations = []
  })

  it.each(['board', 'list'] as const)(
    'applies all search words on the server before %s pagination',
    async (view) => {
      await listLeads({
        view,
        q: 'García Acme 171525',
        status: 'new',
        source: null,
        solutionType: null,
        assignee: null,
        attention: null,
        page: 2,
      })

      expect(state.searchFilters).toEqual([
        'search_text.ilike."%garcia%"',
        'search_text.ilike."%acme%"',
        'search_text.ilike."%171525%",search_phone.ilike."%171525%"',
      ])
      expect(state.inCalls).toContainEqual(['status', ['new']])
      expect(state.leadOperations).toEqual([
        'search',
        'search',
        'search',
        'order',
        ...(view === 'list' ? ['range'] : []),
      ])
    },
  )

  it('searches a pasted phone without depending on its stored formatting', async () => {
    await listLeads({
      view: 'board',
      q: '+34 671 171 525',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })
    expect(state.searchFilters).toEqual([
      'search_text.ilike."%+34 671 171 525%",search_phone.ilike."%671171525%"',
    ])
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

describe('getLeadDetail resilience', () => {
  beforeEach(() => {
    state.rows = []
    state.proposalRows = []
    state.proposalPrices = []
    state.proposalPriceQueries = 0
    state.tasks = []
    state.campaigns = []
    state.ads = []
    state.detailLead = { id: 'lead-1', name: 'María García', utm_campaign: null }
    state.detailLeadError = null
    state.companyResearch = null
    state.companyResearchError = null
    state.auditRows = []
    state.auditTimelineError = null
    state.auditTimelineCalls = []
    state.leadSelect = ''
    state.leadSelections = []
    state.inCalls = []
  })

  it('keeps an existing lead available when optional company-research fields are unavailable', async () => {
    state.companyResearchError = 'column company_research does not exist'

    const result = await getLeadDetail('lead-1')

    expect(result?.lead.id).toBe('lead-1')
    expect(result?.companyResearchAvailable).toBe(false)
    expect(result?.lead.company_research).toBeNull()
  })

  it('loads the scoped audit timeline into the typed lead detail read model', async () => {
    state.auditRows = [
      {
        id: 'event-1',
        occurred_at: '2026-10-09T10:00:00.000Z',
        actor_id: 'member-1',
        actor_name: 'Aina',
        action: 'update',
        changed_fields: ['estimated_value'],
        origin: 'backoffice',
      },
    ]

    const result = await getLeadDetail('lead-1')

    expect(state.auditTimelineCalls).toEqual([
      {
        name: 'list_entity_audit_timeline',
        args: { p_entity_type: 'leads', p_entity_id: 'lead-1', p_limit: 50 },
      },
    ])
    expect(result?.auditEvents).toEqual([
      {
        id: 'event-1',
        entityType: 'leads',
        occurredAt: '2026-10-09T10:00:00.000Z',
        actorId: 'member-1',
        actorName: 'Aina',
        action: 'update',
        changedFields: ['estimated_value'],
        origin: 'backoffice',
      },
    ])
  })

  it('keeps the lead detail available when the optional audit timeline RPC fails', async () => {
    state.auditTimelineError = 'audit timeline unavailable'

    const result = await getLeadDetail('lead-1')

    expect(result?.lead.id).toBe('lead-1')
    expect(result?.auditEvents).toEqual([])
  })

  it('does not query proposal prices unless the caller has enabled them', async () => {
    state.proposalRows = [{ id: 'proposal-1', number: 'P-001' }]

    const result = await getLeadDetail('lead-1')

    expect(state.proposalPriceQueries).toBe(0)
    expect(result?.proposals[0]?.total).toBeNull()
  })

  it('loads proposal prices only when explicitly requested', async () => {
    state.proposalRows = [{ id: 'proposal-1', number: 'P-001' }]
    state.proposalPrices = [{ proposal_id: 'proposal-1', total: '1200.00' }]

    const result = await getLeadDetail('lead-1', { includeProposalPrices: true })

    expect(state.proposalPriceQueries).toBe(1)
    expect(result?.proposals[0]?.total).toBe(1200)
  })

  it('throws a query failure instead of treating it as a missing lead', async () => {
    state.detailLeadError = 'permission denied for table leads'

    await expect(getLeadDetail('lead-1')).rejects.toThrow('No se pudo cargar el lead.')
  })

  it('resolves the Meta ad name from the ID stored in UTM content', async () => {
    state.detailLead = {
      id: 'lead-1',
      name: 'María García',
      utm_campaign: 'campaign-1',
      utm_content: 'ad-1',
    }
    state.campaigns = [{ id: 'campaign-1', name: 'Campaña captación' }]
    state.ads = [{ id: 'ad-1', name: 'Vídeo casos de éxito' }]

    const result = await getLeadDetail('lead-1')

    expect(state.leadSelections.some((selection) => selection.includes('utm_content'))).toBe(true)
    expect(result?.lead.marketing_campaign_name).toBe('Campaña captación')
    expect(result?.lead.marketing_ad_name).toBe('Vídeo casos de éxito')
  })
})
