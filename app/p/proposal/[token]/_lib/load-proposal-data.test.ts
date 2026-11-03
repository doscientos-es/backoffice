import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadProposalData } from './load-proposal-data'

const { from, rows } = vi.hoisted(() => ({
  from: vi.fn(),
  rows: {} as Record<string, unknown>,
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
    return chain
  })
  rows.proposal_items = [{ id: 'line-1' }]
  rows.proposal_specs = [{ id: 'spec-1' }]
  rows.settings = { company_name: 'Example Studio', iban: null }
  rows.invoice_payments = [{ id: 'payment-1' }]
  rows.invoices = { total: 605 }
  rows.team_members = { name: 'Ana', email: 'ana@example.test' }
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
    ])
    expect(data).toEqual({
      items: rows.proposal_items,
      specs: rows.proposal_specs,
      settings: rows.settings,
      payments: rows.invoice_payments,
      depositInvoice: rows.invoices,
      contact: rows.team_members,
    })
  })

  it('does not query team members when no author is assigned', async () => {
    const data = await loadProposalData({ id: 'proposal-1', created_by: null })
    expect(data.contact).toBeNull()
    expect(from).not.toHaveBeenCalledWith('team_members')
  })
})
