import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    proposal: {
      id: '494d62cb-fd56-4650-b131-9e3a927a20ad',
      status: 'accepted',
      title: 'Automatización comercial',
      client_id: 'client-1' as string | null,
      project_id: null,
      notes: null,
      payment_schedule: 'half_half',
      payment_plan: [],
    },
    role: 'member' as 'admin' | 'member' | 'viewer',
    notifications: [] as Array<Record<string, unknown>>,
    invoicedPlanIds: [] as string[],
    insertedInvoices: [] as Array<Record<string, unknown>>,
  },
}))

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(async () => ({ id: 'member-1', name: 'Pol', role: state.role })),
  requireUser: vi.fn(async () => ({
    id: 'member-1',
    name: 'Pol',
    role: state.role,
  })),
}))

vi.mock('@/lib/invoices/queries', () => ({
  findProposalForInvoice: vi.fn(async () => state.proposal),
  findProposalItems: vi.fn(async () => [
    {
      position: 0,
      description: 'Implementación',
      quantity: 1,
      unit_price: 1000,
      vat_rate: 21,
      billing_cycle: 'none',
    },
  ]),
  findClientInfo: vi.fn(async () => ({
    name: 'Acme',
    nif: 'B12345678',
    billing_address_street: 'Calle de prueba 1',
    billing_address_zip: null,
    billing_address_city: null,
    billing_address_province: null,
    billing_address_country: null,
  })),
  findInvoiceSeries: vi.fn(async () => 'A'),
  findNextInvoiceNumberForSeries: vi.fn(async () => state.insertedInvoices.length + 1),
  findInvoicedProposalPaymentPlanIds: vi.fn(async () => new Set(state.invoicedPlanIds)),
  insertInvoiceWithItems: vi.fn(async (invoice, items) => {
    state.insertedInvoices.push({ invoice, items })
    return { id: `invoice-${state.insertedInvoices.length}` }
  }),
}))

vi.mock('@/lib/notifications/dispatch', () => ({
  dispatchNotifications: vi.fn(async (notification) => state.notifications.push(notification)),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        in: () => builder,
        is: () => builder,
        // biome-ignore lint/suspicious/noThenProperty: intentional Supabase builder mock
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [{ id: 'admin-1' }], error: null }).then(resolve),
      }
      return builder
    },
  })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('@/lib/verifactu/outbox', () => ({
  assertDurableVerifactuPackage: vi.fn(),
  deliverInvoiceVerifactu: vi.fn(),
  deliverVerifactuOutbox: vi.fn(),
  syncInvoiceQrFromLedger: vi.fn(),
}))
vi.mock('@/lib/verifactu/diagnostics', () => ({ assertVerifactuDiagnosticGate: vi.fn() }))
vi.mock('@doscientos/verifactu', () => ({ createVerifactuClient: vi.fn() }))

import { createInvoicesFromProposalPlan, requestInvoiceFromProposal } from './actions'

const PROPOSAL_ID = '494d62cb-fd56-4650-b131-9e3a927a20ad'

beforeEach(() => {
  state.proposal.status = 'accepted'
  state.proposal.client_id = 'client-1'
  state.role = 'member'
  state.notifications = []
  state.invoicedPlanIds = []
  state.insertedInvoices = []
})

describe('createInvoicesFromProposalPlan', () => {
  it('creates only the missing editable drafts for a 50/50 proposal', async () => {
    state.role = 'admin'
    state.invoicedPlanIds = ['acceptance']

    const result = await createInvoicesFromProposalPlan({ proposalId: PROPOSAL_ID })

    expect(result).toEqual({ ok: true, ids: ['invoice-1'], created: 1 })
    expect(state.insertedInvoices).toHaveLength(1)
    expect(state.insertedInvoices[0]?.invoice).toMatchObject({
      proposal_payment_plan_item_id: 'delivery',
      status: 'draft',
      total: 605,
    })
  })

  it('explains the missing fiscal link instead of attempting an invalid insert', async () => {
    state.role = 'admin'
    state.proposal.client_id = null

    const result = await createInvoicesFromProposalPlan({ proposalId: PROPOSAL_ID })

    expect(result).toEqual({
      ok: false,
      error:
        'La propuesta aceptada no tiene datos fiscales; completa la ficha fiscal antes de facturar',
    })
    expect(state.insertedInvoices).toEqual([])
  })
})

describe('requestInvoiceFromProposal', () => {
  it('notifies administration for an accepted proposal requested by a commercial', async () => {
    const result = await requestInvoiceFromProposal({ proposalId: PROPOSAL_ID })

    expect(result).toEqual({ ok: true })
    expect(state.notifications).toEqual([
      expect.objectContaining({
        recipientIds: ['admin-1'],
        actorId: 'member-1',
        eventType: 'invoice_requested',
        entityId: PROPOSAL_ID,
        link: `/proposals/${PROPOSAL_ID}`,
      }),
    ])
  })

  it('does not allow viewers to request an invoice', async () => {
    state.role = 'viewer'

    const result = await requestInvoiceFromProposal({ proposalId: PROPOSAL_ID })

    expect(result).toEqual({ ok: false, error: 'No tienes permiso para solicitar facturación' })
    expect(state.notifications).toEqual([])
  })
})
