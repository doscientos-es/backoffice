import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// State controlled per test
// ---------------------------------------------------------------------------
const db: {
  tasks: unknown[]
  myLeads: unknown[]
  unassigned: unknown[]
  proposals: unknown[]
  invoices: unknown[]
} = { tasks: [], myLeads: [], unassigned: [], proposals: [], invoices: [] }
const filters: Array<{ table: string; column: string; value: unknown }> = []
const invoiceDateFilters: Array<{ operator: 'gte' | 'lte'; column: string; value: unknown }> = []

// ---------------------------------------------------------------------------
// Supabase server mock
// Each from() call returns an independent chain that tracks whether
// assigned_to was filtered with eq (owned) or is(null) (unassigned).
// The terminal .limit() resolves to the appropriate fixture.
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      let assignedToMode: 'owned' | 'unassigned' | null = null
      let isCountQuery = false
      let invoiceFrom: string | null = null
      let invoiceTo: string | null = null

      const resolveInvoices = () =>
        db.invoices.filter((row) => {
          const issueDate = (row as { issue_date?: string }).issue_date
          return (
            typeof issueDate === 'string' &&
            (!invoiceFrom || issueDate >= invoiceFrom) &&
            (!invoiceTo || issueDate <= invoiceTo)
          )
        })

      const chain: Record<string, unknown> = {
        select: (_cols: unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) isCountQuery = true
          return chain
        },
        eq: (col: string, value: unknown) => {
          filters.push({ table, column: col, value })
          if (col === 'assigned_to') assignedToMode = 'owned'
          return chain
        },
        is: (col: string, val: unknown) => {
          if (col === 'assigned_to' && val === null) assignedToMode = 'unassigned'
          return chain
        },
        not: (col: string, _operator: string, value: unknown) => {
          filters.push({ table, column: col, value })
          return chain
        },
        in: () => chain,
        gte: (column: string, value: unknown) => {
          if (table === 'invoices') {
            invoiceDateFilters.push({ operator: 'gte', column, value })
            if (column === 'issue_date') invoiceFrom = String(value)
          }
          return chain
        },
        lte: (column: string, value: unknown) => {
          if (table === 'invoices') {
            invoiceDateFilters.push({ operator: 'lte', column, value })
            if (column === 'issue_date') invoiceTo = String(value)
          }
          return chain
        },
        neq: () => chain,
        lt: () => chain,
        order: () => chain,
        limit: async () => {
          if (isCountQuery) return { data: null, count: 0, error: null }
          if (table === 'tasks') return { data: db.tasks, error: null }
          if (table === 'proposals') return { data: db.proposals, error: null }
          if (table === 'invoices') return { data: resolveInvoices(), error: null }
          if (assignedToMode === 'unassigned') return { data: db.unassigned, error: null }
          return { data: db.myLeads, error: null }
        },
        // Count queries (no .limit()) resolve here via Promise.all awaiting the chain.
        // Return count=0 and data=[] as defaults for test isolation.
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Supabase query chains
        then: (resolve: (v: unknown) => void) => {
          const result = isCountQuery
            ? { data: null, count: 0, error: null }
            : table === 'tasks'
              ? { data: db.tasks, error: null }
              : table === 'proposals'
                ? { data: db.proposals, error: null }
                : table === 'invoices'
                  ? { data: resolveInvoices(), error: null }
                  : assignedToMode === 'unassigned'
                    ? { data: db.unassigned, error: null }
                    : { data: db.myLeads, error: null }
          Promise.resolve(result).then(resolve)
        },
        update: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
      }
      return chain
    },
  }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getMyDay', () => {
  beforeEach(() => {
    db.tasks = []
    db.myLeads = []
    db.unassigned = []
    db.proposals = []
    db.invoices = []
    filters.length = 0
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('returns empty arrays when there is no data', async () => {
    const { getMyDay } = await import('@/lib/dashboard/queries')
    const result = await getMyDay({ assigneeId: 'user-1' })

    expect(result.tasks).toEqual([])
    expect(result.myLeads).toEqual([])
    expect(result.unassignedLeads).toEqual([])
  })

  it('maps a task row into MyTaskRow shape', async () => {
    db.tasks = [
      {
        id: 't1',
        title: 'Preparar propuesta',
        status: 'todo',
        priority: 'high',
        due_date: '2026-06-10',
        projects: { name: 'Proyecto Alpha' },
        leads: null,
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { tasks } = await getMyDay({ assigneeId: 'user-1' })

    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      id: 't1',
      title: 'Preparar propuesta',
      status: 'todo',
      priority: 'high',
      due_date: '2026-06-10',
      contextLabel: 'Proyecto Alpha',
    })
  })

  it('uses lead name as contextLabel when task has no project', async () => {
    db.tasks = [
      {
        id: 't2',
        title: 'Llamar cliente',
        status: 'in_progress',
        priority: 'medium',
        due_date: null,
        projects: null,
        leads: { name: 'García SL' },
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { tasks } = await getMyDay({ assigneeId: 'user-1' })

    expect(tasks[0]?.contextLabel).toBe('García SL')
  })

  it('contextLabel is null when neither project nor lead is present', async () => {
    db.tasks = [
      {
        id: 't3',
        title: 'Revisar CRM',
        status: 'todo',
        priority: 'low',
        due_date: null,
        projects: null,
        leads: null,
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { tasks } = await getMyDay({ assigneeId: 'user-1' })

    expect(tasks[0]?.contextLabel).toBeNull()
  })

  it("maps a lead row into ActionLeadRow with updated_at as 'since'", async () => {
    db.myLeads = [
      {
        id: 'l1',
        name: 'Ana Fernández',
        company: 'Tech SL',
        phone: '+34600000001',
        email: 'ana@tech.com',
        status: 'qualifying',
        updated_at: '2026-05-20T10:00:00Z',
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { myLeads } = await getMyDay({ assigneeId: 'user-1' })

    expect(myLeads).toHaveLength(1)
    expect(myLeads[0]).toMatchObject({
      id: 'l1',
      name: 'Ana Fernández',
      company: 'Tech SL',
      status: 'qualifying',
      since: '2026-05-20T10:00:00Z',
    })
  })

  it("maps an unassigned lead with created_at as 'since'", async () => {
    db.unassigned = [
      {
        id: 'l2',
        name: 'Pedro Ruiz',
        company: null,
        phone: null,
        email: 'pedro@example.com',
        status: 'new',
        created_at: '2026-06-01T08:00:00Z',
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { unassignedLeads } = await getMyDay({ assigneeId: 'user-1' })

    expect(unassignedLeads).toHaveLength(1)
    expect(unassignedLeads[0]).toMatchObject({
      id: 'l2',
      name: 'Pedro Ruiz',
      company: null,
      since: '2026-06-01T08:00:00Z',
    })
  })

  it('separates myLeads and unassignedLeads correctly', async () => {
    db.myLeads = [
      {
        id: 'owned',
        name: 'Owned',
        company: null,
        phone: null,
        email: null,
        status: 'new',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    db.unassigned = [
      {
        id: 'free',
        name: 'Free',
        company: null,
        phone: null,
        email: null,
        status: 'new',
        created_at: '2026-01-02T00:00:00Z',
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const result = await getMyDay({ assigneeId: 'user-1' })

    expect(result.myLeads.map((l) => l.id)).toEqual(['owned'])
    expect(result.unassignedLeads.map((l) => l.id)).toEqual(['free'])
  })

  it('does not constrain tasks or leads to a member for the team scope', async () => {
    const { getMyDay } = await import('@/lib/dashboard/queries')
    await getMyDay({ assigneeId: null })

    expect(filters.some((filter) => filter.column === 'assignee_id')).toBe(false)
    expect(filters).toContainEqual({ table: 'leads', column: 'assigned_to', value: null })
  })
})

describe('getDashboardKpis', () => {
  beforeEach(() => {
    invoiceDateFilters.length = 0
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('filters revenue by the selected current and comparison windows', async () => {
    const { getDashboardKpis } = await import('@/lib/dashboard/queries')
    await getDashboardKpis({
      current: { from: new Date('2026-05-08T12:00:00Z'), to: new Date('2026-05-15T12:00:00Z') },
      previous: { from: new Date('2026-05-01T12:00:00Z'), to: new Date('2026-05-08T12:00:00Z') },
    })

    expect(invoiceDateFilters).toEqual([
      { operator: 'gte', column: 'issue_date', value: '2026-05-08' },
      { operator: 'lte', column: 'issue_date', value: '2026-05-15' },
      { operator: 'gte', column: 'issue_date', value: '2026-05-01' },
      { operator: 'lte', column: 'issue_date', value: '2026-05-08' },
    ])
  })
})

describe('getRevenueSeries', () => {
  beforeEach(() => {
    invoiceDateFilters.length = 0
    db.invoices = []
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('uses the selected dashboard range for both revenue queries', async () => {
    const { getRevenueSeries } = await import('@/lib/dashboard/queries')
    await getRevenueSeries('30d')

    expect(invoiceDateFilters).toEqual([
      { operator: 'gte', column: 'issue_date', value: '2026-05-16' },
      { operator: 'lte', column: 'issue_date', value: '2026-06-15' },
      { operator: 'gte', column: 'issue_date', value: '2026-04-16' },
      { operator: 'lte', column: 'issue_date', value: '2026-05-15' },
    ])
  })

  it('keeps current and previous amounts in the same visible slots', async () => {
    db.invoices = [
      { issue_date: '2026-06-01', total: 300, projects: null, clients: null },
      { issue_date: '2026-05-01', total: 100, projects: null, clients: null },
    ]

    const { getRevenueSeries } = await import('@/lib/dashboard/queries')
    const result = await getRevenueSeries('30d')

    expect(result.totals).toEqual([
      { month: 'may', current: 0, previous: 0 },
      { month: 'jun', current: 300, previous: 100 },
    ])
  })
})

describe('getActionCenter', () => {
  beforeEach(() => {
    db.tasks = []
    db.myLeads = []
    db.unassigned = []
    db.proposals = []
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('adds lead context to proposal follow-up items', async () => {
    db.proposals = [
      {
        id: 'p1',
        title: 'Web corporativa',
        number: 'P-001',
        sent_at: '2026-06-01T08:00:00Z',
        leads: { name: 'Ana Fernández', company: 'Tech SL' },
        clients: null,
      },
    ]

    const { getActionCenter } = await import('@/lib/dashboard/queries')
    const result = await getActionCenter({ memberId: 'user-1', showFinance: false })

    expect(result.items[0]).toMatchObject({
      title: 'Web corporativa',
      detail:
        'Lead: Ana Fernández · Tech SL · Propuesta enviada hace más de 72 horas sin respuesta.',
    })
  })

  it('falls back to client context when the proposal has no lead', async () => {
    db.proposals = [
      {
        id: 'p2',
        title: 'Web corporativa',
        number: 'P-002',
        sent_at: '2026-06-01T08:00:00Z',
        leads: null,
        clients: { name: 'Cliente Demo' },
      },
    ]

    const { getActionCenter } = await import('@/lib/dashboard/queries')
    const result = await getActionCenter({ memberId: 'user-1', showFinance: false })

    expect(result.items[0]?.detail).toContain('Cliente: Cliente Demo')
  })
})
