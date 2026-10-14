import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), listPage: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requirePagePermission: async () => ({ role: 'sales' }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/components/layout/list-page', () => ({
  ListPage: (props: { actions: React.ReactNode }) => {
    mocks.listPage(props)
    return <div>{props.actions}</div>
  },
}))

import ProposalsPage from './page'

const builders = new Map<string, Record<string, ReturnType<typeof vi.fn>>>()
beforeEach(() => {
  vi.clearAllMocks()
  builders.clear()
  mocks.from.mockImplementation((table: string) => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'is', 'in', 'eq', 'lt', 'order', 'range'])
      builder[method] = vi.fn(() => builder)
    // oxlint-disable-next-line unicorn/no-thenable -- Match the awaitable Supabase query-builder contract.
    builder.then = vi.fn((resolve: (result: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
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
})
