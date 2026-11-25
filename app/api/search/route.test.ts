import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    leadSelect: '',
    leadOr: '',
    role: 'member',
    clients: [] as {
      id: string
      name: string
      nif: string | null
      email: string | null
      leads: { id: string; deleted_at: string | null } | null
    }[],
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: state.role })),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => {
      const chain = {
        select: vi.fn(),
        is: vi.fn(),
        or: vi.fn(),
        ilike: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
      }
      chain.select.mockImplementation((columns: string) => {
        if (table === 'leads') state.leadSelect = columns
        return chain
      })
      chain.is.mockImplementation(() => chain)
      chain.or.mockImplementation((filter: string) => {
        if (table === 'leads') state.leadOr = filter
        return chain
      })
      chain.ilike.mockImplementation(() => chain)
      chain.order.mockImplementation(() => chain)
      chain.limit.mockImplementation(async () => ({
        data:
          table === 'leads'
            ? [
                {
                  id: 'lead-1',
                  name: 'Juan García',
                  alias: 'Spinola',
                  company: 'Piscinas S.L.',
                  email: null,
                  phone: '600 555 123',
                },
              ]
            : table === 'clients'
              ? state.clients
              : [],
        error: null,
      }))
      return chain
    },
  })),
}))

import { GET } from './route'

describe('GET /api/search', () => {
  it('searches leads by alias and uses it as the displayed name', async () => {
    const response = await GET(new NextRequest('http://localhost/api/search?q=Spinola'))
    const body = await response.json()

    expect(state.leadSelect).toBe('id, name, alias, company, email, phone')
    expect(state.leadOr).toBe(
      'name.ilike.%Spinola%,alias.ilike.%Spinola%,company.ilike.%Spinola%,email.ilike.%Spinola%,phone.ilike.%Spinola%',
    )
    expect(body.items).toEqual([
      {
        id: 'lead-lead-1',
        type: 'lead',
        label: 'Spinola',
        sublabel: 'Juan García · Piscinas S.L. · 600 555 123',
        href: '/leads/lead-1',
      },
    ])
  })

  it('matches formatted phone numbers when searching with digits only', async () => {
    await GET(new NextRequest('http://localhost/api/search?q=600555123'))

    expect(state.leadOr).toContain('phone.ilike.%6%0%0%5%5%5%1%2%3%')
  })

  it('resolves fiscal matches to leads without duplicating a matching lead', async () => {
    state.role = 'owner'
    state.clients = [
      {
        id: 'client-1',
        name: 'Piscinas',
        nif: 'B12345678',
        email: null,
        leads: { id: 'lead-1', deleted_at: null },
      },
      {
        id: 'client-2',
        name: 'Otra empresa',
        nif: 'B87654321',
        email: null,
        leads: { id: 'lead-2', deleted_at: null },
      },
    ]
    const body = await (await GET(new NextRequest('http://localhost/api/search?q=B'))).json()
    expect(body.items.filter((item: { id: string }) => item.id === 'lead-lead-1')).toHaveLength(1)
    expect(body.items).toContainEqual(
      expect.objectContaining({
        id: 'lead-lead-2',
        type: 'lead',
        href: '/leads/lead-2',
        sublabel: 'B87654321',
      }),
    )
    state.clients = []
  })

  it('keeps fiscal matches accessible to roles without CRM access', async () => {
    state.role = 'accountant'
    state.clients = [
      { id: 'client-1', name: 'Empresa', nif: 'B12345678', email: null, leads: null },
    ]
    const body = await (await GET(new NextRequest('http://localhost/api/search?q=B'))).json()
    expect(body.items).toContainEqual(
      expect.objectContaining({
        id: 'client-client-1',
        type: 'client',
        href: '/clients/client-1',
      }),
    )
    state.role = 'member'
    state.clients = []
  })
})
