import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), requireRole: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/lib/subscriptions/generate-invoices', () => ({
  generateNextSubscriptionInvoice: vi.fn(),
  generateSubscriptionInvoices: vi.fn(),
}))

import { createSubscription, updateSubscription } from './actions'

const leadId = '10000000-0000-4000-8000-000000000001'
const clientId = '10000000-0000-4000-8000-000000000002'
const subscriptionId = '10000000-0000-4000-8000-000000000003'
const projectId = '10000000-0000-4000-8000-000000000004'
const input = {
  lead_id: leadId,
  project_id: projectId,
  name: 'Mantenimiento',
  amount: 60,
  start_date: '2026-12-01',
}

function queryBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
  }
}

describe('subscription lead ownership', () => {
  let clients: ReturnType<typeof queryBuilder>
  let subscriptions: ReturnType<typeof queryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()
    clients = queryBuilder()
    subscriptions = queryBuilder()
    mocks.requireRole.mockResolvedValue({ role: 'accountant' })
    mocks.from.mockImplementation((table: string) =>
      table === 'clients' ? clients : subscriptions,
    )
  })

  it('resolves the active fiscal record from the submitted lead and keeps the project', async () => {
    clients.maybeSingle.mockResolvedValue({ data: { id: clientId } })

    await expect(createSubscription(input)).resolves.toEqual({ ok: true })

    expect(mocks.requireRole).toHaveBeenCalledWith(['owner', 'admin', 'accountant'])
    expect(clients.eq).toHaveBeenCalledWith('lead_id', leadId)
    expect(clients.is).toHaveBeenCalledWith('deleted_at', null)
    expect(subscriptions.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: leadId,
        client_id: clientId,
        project_id: projectId,
        next_invoice_date: input.start_date,
      }),
    )
  })

  it('rejects the creation without an active fiscal record', async () => {
    clients.maybeSingle.mockResolvedValue({ data: null })

    await expect(createSubscription(input)).resolves.toEqual({
      ok: false,
      error: expect.stringContaining('datos de facturación'),
    })
    expect(subscriptions.insert).not.toHaveBeenCalled()
  })

  it('allows editing an existing subscription without substituting its historical fiscal record', async () => {
    subscriptions.maybeSingle
      .mockResolvedValueOnce({ data: { lead_id: leadId, status: 'active' } })
      .mockResolvedValueOnce({ data: { version: 2 } })

    await expect(
      updateSubscription({ ...input, id: subscriptionId, expected_version: 1 }),
    ).resolves.toEqual({ ok: true, version: 2 })

    expect(mocks.from).not.toHaveBeenCalledWith('clients')
    const update = subscriptions.update.mock.calls[0]?.[0]
    expect(update).toMatchObject({ lead_id: leadId, project_id: projectId })
    expect(update).not.toHaveProperty('client_id')
  })
})
