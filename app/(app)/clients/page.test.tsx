import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'owner' }))
vi.mock('@/lib/auth', () => ({ requireUser: async () => ({ role: state.role }) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
vi.mock('@/lib/clients/queries', () => ({ listClients: async () => ({ data: [], count: 0 }) }))

import NewClientPage from './new/page'
import ClientsPage from './page'

describe('legacy billing routes', () => {
  beforeEach(() => {
    state.role = 'owner'
  })

  it('routes commercial users to the unified lead directory and creation form', async () => {
    await expect(ClientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'redirect:/leads',
    )
    await expect(NewClientPage()).rejects.toThrow('redirect:/leads/new')
  })

  it('keeps the fiscal directory available to finance without CRM access', async () => {
    state.role = 'accountant'
    const page = await ClientsPage({ searchParams: Promise.resolve({}) })
    expect(page.props.title).toBe('Datos de facturación')
    expect(page.props.addHref).toBe('/clients/new')
  })

  it('does not offer fiscal creation to a delivery-only user', async () => {
    state.role = 'delivery'
    const page = await ClientsPage({ searchParams: Promise.resolve({}) })
    expect(page.props.addHref).toBeUndefined()
    expect(page.props.actions).toBeUndefined()
  })
})
