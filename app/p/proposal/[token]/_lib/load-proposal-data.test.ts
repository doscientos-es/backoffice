import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadProposalData } from './load-proposal-data'

const { from, rows, queries } = vi.hoisted(() => ({
  from: vi.fn(),
  rows: {} as Record<string, unknown>,
  queries: {} as Record<
    string,
    {
      select: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
      is: ReturnType<typeof vi.fn>
      order: ReturnType<typeof vi.fn>
    }
  >,
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

beforeEach(() => {
  vi.clearAllMocks()
  from.mockImplementation((table: string) => {
    const result = Promise.resolve({ data: rows[table] })
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      not: vi.fn(() => chain),
      is: vi.fn(() => chain),
      maybeSingle: vi.fn(() => result),
      then: result.then.bind(result),
    }
    queries[table] = chain
    return chain
  })
  rows.proposal_items = [{ id: 'line-1' }]
  rows.proposal_specs = [{ id: 'spec-1' }]
  rows.settings = { company_name: 'Example Studio', iban: null }
  rows.invoice_payments = [{ id: 'payment-1' }]
  rows.invoices = { total: 605 }
  rows.team_members = { name: 'Ana', email: 'ana@example.test' }
  rows.proposal_team_members = []
})

describe('loadProposalData', () => {
  it('loads proposal, payment and contact data using only the retained tables', async () => {
    const data = await loadProposalData({ id: 'proposal-1', created_by: 'member-1' })

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'proposal_items',
      'proposal_specs',
      'settings',
      'invoice_payments',
      'invoices',
      'team_members',
      'proposal_team_members',
    ])
    expect(data).toEqual({
      items: rows.proposal_items,
      specs: rows.proposal_specs,
      settings: rows.settings,
      payments: rows.invoice_payments,
      depositInvoice: rows.invoices,
      contact: rows.team_members,
      team: [],
    })
  })

  it('does not query team members when no author is assigned', async () => {
    const data = await loadProposalData({ id: 'proposal-1', created_by: null })
    expect(data.contact).toBeNull()
    expect(from).not.toHaveBeenCalledWith('team_members')
  })

  it('loads only assigned active members in proposal order and uses public contact addresses', async () => {
    rows.proposal_team_members = [
      {
        team_members: {
          id: 'member-2',
          name: 'Alex',
          job_title: 'Designer',
          avatar_url: null,
          contact_email: ' alex@example.test ',
          email_alias: 'alias@example.test',
          email: 'private@example.test',
        },
      },
      {
        team_members: {
          id: 'member-1',
          name: 'Sam',
          job_title: null,
          avatar_url: null,
          contact_email: null,
          email_alias: 'sam@example.test',
        },
      },
      {
        team_members: {
          id: 'member-3',
          name: 'Jo',
          job_title: null,
          avatar_url: null,
          contact_email: null,
          email_alias: null,
          email: 'private@example.test',
        },
      },
    ]

    const { team } = await loadProposalData({ id: 'proposal-1', created_by: null })

    const query = queries.proposal_team_members!
    expect(query.select).toHaveBeenCalledWith(
      'team_members!inner(id, name, job_title, avatar_url, contact_email, email_alias)',
    )
    expect(query.eq).toHaveBeenCalledWith('proposal_id', 'proposal-1')
    expect(query.is).toHaveBeenCalledWith('team_members.deleted_at', null)
    expect(query.order).toHaveBeenCalledWith('position')
    expect(team.map(({ id, contactEmail }) => ({ id, contactEmail }))).toEqual([
      { id: 'member-2', contactEmail: 'alex@example.test' },
      { id: 'member-1', contactEmail: 'sam@example.test' },
      { id: 'member-3', contactEmail: null },
    ])
    expect(team[0]).not.toHaveProperty('email')
  })
})
