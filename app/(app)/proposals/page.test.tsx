import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listPage: vi.fn(),
  role: 'sales',
  leadClient: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ requirePagePermission: async () => ({ role: mocks.role }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/components/layout/list-page', () => ({
  ListPage: (props: { actions: React.ReactNode }) => {
    mocks.listPage(props)
    return <div>{props.actions}</div>
  },
}))

import ProposalsPage from './page'

const builders = new Map<string, Record<string, ReturnType<typeof vi.fn>>>()
const results = new Map<string, unknown>()
beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'sales'
  mocks.leadClient.mockResolvedValue({ data: null })
  builders.clear()
  results.clear()
  mocks.from.mockImplementation((table: string) => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of [
      'select',
      'is',
      'in',
      'eq',
      'lt',
      'order',
      'range',
      'or',
      'gte',
      'lte',
      'limit',
    ])
      builder[method] = vi.fn(() => builder)
    builder.maybeSingle = mocks.leadClient
    // oxlint-disable-next-line unicorn/no-thenable -- Match the awaitable Supabase query-builder contract.
    builder.then = vi.fn((resolve: (result: unknown) => unknown, reject) =>
      Promise.resolve(results.get(table) ?? { data: [], error: null, count: 0 }).then(
        resolve,
        reject,
      ),
    )
    builders.set(table, builder)
    return builder
  })
})

describe('ProposalsPage follow-up filters', () => {
  it('shows unanswered proposals oldest first in the follow-up queue', async () => {
    render(await ProposalsPage({ searchParams: Promise.resolve({ followup: 'waiting_72' }) }))
    const query = builders.get('proposals')
    expect(query?.in).toHaveBeenCalledWith('status', ['sent', 'viewed'])
    expect(query?.is).toHaveBeenCalledWith('responded_at', null)
    expect(query?.lt).toHaveBeenCalledWith('sent_at', expect.any(String))
    expect(query?.order).toHaveBeenCalledWith('sent_at', { ascending: true, nullsFirst: false })
    expect(screen.getByRole('link', { name: 'Revisar seguimientos' }).getAttribute('href')).toBe(
      '/proposals?followup=waiting_72',
    )
  })
  it('distinguishes viewed proposals from those with no recorded opening', async () => {
    await ProposalsPage({ searchParams: Promise.resolve({ followup: 'viewed' }) })
    expect(builders.get('proposals')?.eq).toHaveBeenCalledWith('status', 'viewed')
    await ProposalsPage({ searchParams: Promise.resolve({ followup: 'not_viewed' }) })
    expect(builders.get('proposals')?.eq).toHaveBeenCalledWith('status', 'sent')
    expect(builders.get('proposals')?.is).toHaveBeenCalledWith('viewed_at', null)
  })
  it('preserves the usual newest-first ordering outside follow-up mode', async () => {
    await ProposalsPage({ searchParams: Promise.resolve({}) })
    expect(builders.get('proposals')?.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
      nullsFirst: false,
    })
  })

  it('runs proposals while client filter options are still loading', async () => {
    let finish!: (value: unknown) => void
    results.set(
      'clients',
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const page = ProposalsPage({ searchParams: Promise.resolve({}) })
    try {
      await vi.waitFor(() => expect(builders.get('proposals')?.then).toHaveBeenCalled())
    } finally {
      finish({ data: [{ id: 'client-1', name: 'Test client' }] })
    }
    const result = await page
    expect(result.props.filters).toContainEqual(
      expect.objectContaining({
        key: 'client',
        options: [{ value: 'client-1', label: 'Test client' }],
      }),
    )
  })

  it('still waits for the selected lead client before building the proposal filter', async () => {
    const lead = '00000000-0000-4000-8000-000000000001'
    let finish!: (value: { data: { id: string } }) => void
    mocks.leadClient.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const page = ProposalsPage({ searchParams: Promise.resolve({ lead }) })
    await vi.waitFor(() => expect(mocks.leadClient).toHaveBeenCalled())
    expect(builders.get('proposals')?.then).not.toHaveBeenCalled()
    finish({ data: { id: 'client-1' } })
    await page
    expect(builders.get('proposals')?.or).toHaveBeenCalledWith(
      `lead_id.eq.${lead},client_id.eq.client-1`,
    )
  })

  it.each(['sales', 'delivery'])('preserves price visibility for %s', async (role) => {
    mocks.role = role
    results.set('proposals', { data: [{ id: 'proposal-1', title: 'Test', status: 'draft' }] })
    results.set('proposal_prices', { data: [{ proposal_id: 'proposal-1', total: 120 }] })
    const page = await ProposalsPage({ searchParams: Promise.resolve({}) })
    expect(mocks.from.mock.calls.some(([table]) => table === 'proposal_prices')).toBe(
      role === 'sales',
    )
    expect(page.props.rows[0].cells.importe?.value).toBe(role === 'sales' ? 120 : undefined)
  })
})
