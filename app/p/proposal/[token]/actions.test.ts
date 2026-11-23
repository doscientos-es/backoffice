import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

import type {
  acceptProposal as AcceptProposalAction,
  initiateProposalPayment as InitiateProposalPaymentAction,
  rejectProposal as RejectProposalAction,
} from './actions'

const {
  assertRedsysConfigured,
  createDepositInvoice,
  createProposalDraftInvoices,
  notifyInvoiceDraftsReady,
  createRedsysPayment,
  isPortalUnlocked,
  sendProposalAcceptedEmail,
} = vi.hoisted(() => ({
  assertRedsysConfigured: vi.fn(),
  createDepositInvoice: vi.fn(
    async (): Promise<
      { ok: true; invoiceId: string; total: number; status: string } | { ok: false; error: string }
    > => ({ ok: true, invoiceId: 'inv-1', total: 500, status: 'draft' }),
  ),
  createProposalDraftInvoices: vi.fn(async () => ({ ids: [] as string[], created: 0 })),
  notifyInvoiceDraftsReady: vi.fn(async () => undefined),
  createRedsysPayment: vi.fn(() => ({
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: 'params',
    Ds_Signature: 'signature',
  })),
  isPortalUnlocked: vi.fn(async () => true),
  sendProposalAcceptedEmail: vi.fn(async () => undefined),
}))

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'vitest' }) }))
vi.mock('@/lib/email/app-url', () => ({ externalAppUrl: () => 'https://app.example.test' }))
vi.mock('@/lib/env', () => ({
  isGoogleEnabled: () => false,
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://app.example.test' },
  serverEnv: () => ({
    LOG_LEVEL: 'info',
    REDSYS_MERCHANT_CODE: 'merchant',
    REDSYS_TERMINAL: '1',
    REDSYS_CURRENCY: '978',
  }),
}))
vi.mock('@/lib/invoices/proposal-drafts', () => ({
  createProposalDraftInvoices,
  notifyInvoiceDraftsReady,
}))
vi.mock('@/lib/invoices/create-deposit-invoice', () => ({ createDepositInvoice }))
vi.mock('@/lib/integrations/send-proposal-accepted-email', () => ({ sendProposalAcceptedEmail }))
vi.mock('@/lib/integrations/redsys', () => ({
  assertRedsysConfigured,
  createRedsysPayment,
  getRedsysUrl: () => 'https://redsys.example.test',
}))
vi.mock('@/lib/portal/access', () => ({
  isPortalUnlocked,
  unlockPortalResource: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => ({ ok: false })) }))
vi.mock('@/lib/proposals/record-client-view', () => ({ recordClientSignIntent: vi.fn() }))
vi.mock('@/lib/proposals/engagement', () => ({
  CLIENT_REPORTABLE_ENGAGEMENT: ['pricing_viewed', 'terms_viewed', 'whatsapp_click'],
  recordProposalEngagement: vi.fn(),
}))

type ProposalRow = {
  id: string
  status: string
  document_revision?: number
  provider_signature?: unknown
  valid_until?: string | null
  is_client_visible?: boolean | null
  portal_password_hash?: string | null
  total?: number
  payment_schedule?: string
  maintenance_options?: unknown
  maintenance_selected_plan_id?: string | null
  lead_id?: string | null
  client_id?: string | null
  clients?: {
    name: string | null
    nif: string | null
    billing_address_street: string | null
  } | null
} | null
type FetchResult = { data: ProposalRow; error: unknown }
type UpdateResult = { error: unknown }
type RpcResult = { data?: unknown; error: unknown }

const state: {
  fetchResult: FetchResult
  updateResult: UpdateResult
  rpcResult: RpcResult
  lastPatch: Record<string, unknown> | null
  lastUpdateId: string | null
  lastRpc: { name: string; args: Record<string, unknown> } | null
} = {
  fetchResult: { data: null, error: null },
  updateResult: { error: null },
  rpcResult: { error: null },
  lastPatch: null,
  lastUpdateId: null,
  lastRpc: null,
}

// Mock builder keyed on the primary lookup: only the query that filters by
// `portal_token` resolves to `state.fetchResult`. Every secondary lookup used
// by the side-effect helpers (ensureProjectForProposal, promoteLeadFromClient,
// ensureClientForProposal) filters by other columns and resolves to empty, so
// they short-circuit without polluting the assertions.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (_table: string) => {
      const empty = { data: null, error: null }
      let isPrimary = false
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string) => {
          if (col === 'portal_token') isPrimary = true
          return chain
        },
        is: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () =>
          isPrimary && state.fetchResult.data
            ? { ...state.fetchResult, data: { document_revision: 1, ...state.fetchResult.data } }
            : isPrimary
              ? state.fetchResult
              : empty,
        single: async () => empty,
        insert: () => chain,
        update: (patch: Record<string, unknown>) => {
          state.lastPatch = patch
          return {
            eq: (_col: string, id: string) => {
              state.lastUpdateId = id
              return { in: async () => state.updateResult }
            },
          }
        },
      }
      return chain
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      state.lastRpc = { name, args }
      return Promise.resolve(state.rpcResult)
    },
  }),
}))

const VALID_TOKEN = 'a'.repeat(48)
const SIGNATURE = {
  signer_name: 'Ana Gómez',
  signer_role: 'Administradora',
  accepts_terms: true,
  client_capacity: 'business',
} as const

// A client row with the minimum fiscal data so `acceptWithFiscal` skips the
// fiscal-form requirement and exercises the electronic acceptance flow.
const COMPLETE_CLIENT = {
  name: 'Acme SL',
  nif: 'B12345678',
  billing_address_street: 'Calle Mayor 1, Madrid',
}

let acceptProposal: typeof AcceptProposalAction
let initiateProposalPayment: typeof InitiateProposalPaymentAction
let rejectProposal: typeof RejectProposalAction

beforeAll(async () => {
  const actions = await import('./actions')
  acceptProposal = (token, signature, fiscal, revision = 1) =>
    actions.acceptProposal(token, signature, fiscal, revision)
  initiateProposalPayment = actions.initiateProposalPayment
  rejectProposal = actions.rejectProposal
}, 30_000)

describe('portal proposal actions', () => {
  beforeEach(() => {
    state.fetchResult = { data: null, error: null }
    state.updateResult = { error: null }
    state.rpcResult = { error: null }
    state.lastPatch = null
    state.lastUpdateId = null
    state.lastRpc = null
    createProposalDraftInvoices.mockClear()
    createDepositInvoice.mockClear()
    assertRedsysConfigured.mockReset()
    createRedsysPayment.mockClear()
    isPortalUnlocked.mockReset()
    isPortalUnlocked.mockResolvedValue(true)
    sendProposalAcceptedEmail.mockClear()
    revalidatePath.mockClear()
  })

  it('rejects malformed tokens without touching the DB', async () => {
    const result = await acceptProposal('short', SIGNATURE)
    expect(result).toEqual({ ok: false, error: 'Token inválido' })
    expect(state.lastPatch).toBeNull()
  })

  it('returns not-found when the proposal does not exist', async () => {
    state.fetchResult = { data: null, error: null }

    const result = await acceptProposal(VALID_TOKEN, SIGNATURE)
    expect(result).toEqual({ ok: false, error: 'Propuesta no encontrada' })
  })

  it('blocks transitions from already-responded states', async () => {
    state.fetchResult = { data: { id: 'p1', status: 'accepted' }, error: null }
    expect(await acceptProposal(VALID_TOKEN, SIGNATURE)).toEqual({
      ok: false,
      error: 'Esta propuesta ya ha sido respondida',
    })

    state.fetchResult = { data: { id: 'p1', status: 'rejected' }, error: null }
    expect(await rejectProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: 'Esta propuesta ya ha sido respondida',
    })
  })

  it('blocks transitions from draft or expired', async () => {
    state.fetchResult = { data: { id: 'p1', status: 'draft' }, error: null }
    expect(await acceptProposal(VALID_TOKEN, SIGNATURE)).toEqual({
      ok: false,
      error: 'Propuesta no disponible',
    })

    state.fetchResult = { data: { id: 'p1', status: 'expired' }, error: null }
    expect(await acceptProposal(VALID_TOKEN, SIGNATURE)).toEqual({
      ok: false,
      error: 'Propuesta expirada',
    })

    state.fetchResult = {
      data: { id: 'p1', status: 'sent', valid_until: '2000-01-01' },
      error: null,
    }
    expect(await acceptProposal(VALID_TOKEN, SIGNATURE)).toEqual({
      ok: false,
      error: 'Propuesta expirada',
    })
    expect(state.lastRpc).toBeNull()
  })

  it('requires an unlocked, visible portal for every public mutation', async () => {
    state.fetchResult = {
      data: {
        id: 'p1',
        status: 'sent',
        is_client_visible: true,
        portal_password_hash: 'protected',
        maintenance_options: DEFAULT_MAINTENANCE_OFFER,
      },
      error: null,
    }
    isPortalUnlocked.mockResolvedValue(false)

    await expect(rejectProposal(VALID_TOKEN)).resolves.toEqual({
      ok: false,
      error: 'Vuelve a introducir la contraseña del portal',
    })
    state.fetchResult = {
      data: {
        id: '494d62cb-fd56-4650-b131-9e3a927a20ad',
        status: 'accepted',
        is_client_visible: true,
        portal_password_hash: 'protected',
      },
      error: null,
    }
    await expect(
      initiateProposalPayment('494d62cb-fd56-4650-b131-9e3a927a20ad', VALID_TOKEN),
    ).resolves.toEqual({ ok: false, error: 'Propuesta no disponible para pago' })
    expect(state.lastPatch).toBeNull()
  })

  it('accepts a sent proposal and revalidates the portal path', async () => {
    state.fetchResult = {
      data: { id: 'p1', status: 'sent', lead_id: null, client_id: 'c1', clients: COMPLETE_CLIENT },
      error: null,
    }

    const result = await acceptProposal(VALID_TOKEN, SIGNATURE)
    expect(result).toEqual({ ok: true })
    expect(state.lastRpc?.name).toBe('accept_proposal_with_evidence_versioned')
    expect(state.lastRpc?.args).toMatchObject({
      p_proposal_id: 'p1',
      p_document_revision: 1,
      p_signer_name: 'Ana Gómez',
      p_evidence_version: 'doscientos-proposal-acceptance-v5',
      p_document_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_document_snapshot: expect.objectContaining({
        parties: expect.objectContaining({
          client: expect.objectContaining({ name: 'Acme SL', nif: 'B12345678' }),
        }),
        contract: { client_capacity: 'business', consumer_early_start_requested: false },
      }),
    })
    expect(state.lastRpc?.args.p_consent_text).not.toContain('consumidor')
    expect(createProposalDraftInvoices).toHaveBeenCalledWith(expect.anything(), 'p1', null)
    expect(notifyInvoiceDraftsReady).toHaveBeenCalledWith(expect.anything(), 'p1', [])
    expect(revalidatePath).toHaveBeenCalledWith(`/p/proposal/${VALID_TOKEN}`)
  })

  it('rejects a stale page before writing fiscal data or recording acceptance', async () => {
    state.fetchResult = {
      data: { id: 'p1', status: 'sent', document_revision: 2, clients: COMPLETE_CLIENT },
      error: null,
    }
    expect(await acceptProposal(VALID_TOKEN, SIGNATURE)).toEqual({
      ok: false,
      error: 'La propuesta ha cambiado. Actualiza la página antes de firmar',
    })
    expect(state.lastRpc).toBeNull()
    expect(state.lastPatch).toBeNull()
  })

  it('includes the issued provider signature in the hashed acceptance evidence', async () => {
    const provider = {
      member_id: '00000000-0000-4000-8000-000000000001',
      name: 'Responsable',
      job_title: null,
      drawing: { version: 1, strokes: [[{ x: 10, y: 20 }]] },
    }
    state.fetchResult = {
      data: { id: 'p1', status: 'sent', clients: COMPLETE_CLIENT, provider_signature: provider },
      error: null,
    }
    expect(await acceptProposal(VALID_TOKEN, SIGNATURE)).toEqual({ ok: true })
    const args = state.lastRpc?.args
    expect(args?.p_document_snapshot).toMatchObject({ provider_signature: provider })
    const { proposalAcceptanceHash } = await import('@/lib/proposals/proposal-acceptance')
    expect(args?.p_document_hash).toBe(proposalAcceptanceHash(args?.p_document_snapshot))
  })

  it('records consumer capacity and the early-start request in the signed evidence', async () => {
    state.fetchResult = {
      data: { id: 'p1', status: 'sent', lead_id: null, client_id: 'c1', clients: COMPLETE_CLIENT },
      error: null,
    }

    await acceptProposal(VALID_TOKEN, {
      ...SIGNATURE,
      client_capacity: 'consumer',
      consumer_early_start: true,
    })
    expect(state.lastRpc?.args).toMatchObject({
      p_document_snapshot: expect.objectContaining({
        contract: { client_capacity: 'consumer', consumer_early_start_requested: true },
      }),
      p_consent_text: expect.stringContaining('solicito expresamente'),
    })
  })

  it('binds a validated handwritten signature to the immutable acceptance snapshot and hash', async () => {
    state.fetchResult = {
      data: { id: 'p1', status: 'sent', lead_id: null, client_id: 'c1', clients: COMPLETE_CLIENT },
      error: null,
    }
    const drawing = {
      version: 1 as const,
      strokes: [
        [
          { x: 10, y: 20 },
          { x: 50, y: 60 },
        ],
      ],
    }
    await acceptProposal(VALID_TOKEN, { ...SIGNATURE, handwritten_signature: drawing })
    const args = state.lastRpc?.args
    expect(args?.p_document_snapshot).toMatchObject({ handwritten_signature: drawing })
    const { proposalAcceptanceHash } = await import('@/lib/proposals/proposal-acceptance')
    expect(args?.p_document_hash).toBe(proposalAcceptanceHash(args?.p_document_snapshot))
    expect(args?.p_document_hash).not.toBe(
      proposalAcceptanceHash({
        ...(args?.p_document_snapshot as Record<string, unknown>),
        handwritten_signature: { version: 1, strokes: [[{ x: 11, y: 20 }]] },
      }),
    )
  })

  it('rejects invalid or excessive signature data before accessing the database', async () => {
    const result = await acceptProposal(VALID_TOKEN, {
      ...SIGNATURE,
      handwritten_signature: { version: 1, strokes: [[{ x: -1, y: 20 }]] },
    })
    expect(result.ok).toBe(false)
    expect(state.lastRpc).toBeNull()
    const { HandwrittenSignatureSchema } = await import('@/lib/proposals/handwritten-signature')
    expect(
      HandwrittenSignatureSchema.safeParse({
        version: 1,
        strokes: Array.from({ length: 4 }, () =>
          Array.from({ length: 1600 }, () => ({ x: 0, y: 0 })),
        ),
      }).success,
    ).toBe(false)
  })

  it('rejects a viewed proposal and stores the rejection reason', async () => {
    state.fetchResult = { data: { id: 'p2', status: 'viewed' }, error: null }

    const result = await rejectProposal(VALID_TOKEN, 'No es lo que buscamos')
    expect(result).toEqual({ ok: true })
    expect(state.lastRpc).toMatchObject({
      name: 'reject_proposal_from_portal',
      args: {
        p_proposal_id: 'p2',
        p_rejection_reason: 'No es lo que buscamos',
      },
    })
  })

  it('omits signature_data when no rejection reason is provided', async () => {
    state.fetchResult = { data: { id: 'p3', status: 'sent' }, error: null }

    await rejectProposal(VALID_TOKEN)
    expect(state.lastRpc).toMatchObject({
      name: 'reject_proposal_from_portal',
      args: { p_rejection_reason: null },
    })
  })

  it('surfaces acceptance evidence persistence errors', async () => {
    state.fetchResult = {
      data: { id: 'p4', status: 'sent', lead_id: null, client_id: 'c1', clients: COMPLETE_CLIENT },
      error: null,
    }
    state.rpcResult = { error: { message: 'db down' } }

    const result = await acceptProposal(VALID_TOKEN, SIGNATURE)
    expect(result).toEqual({ ok: false, error: 'No se pudo registrar la firma de la propuesta' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('does not expose a maintenance selection action', async () => {
    const actions = await import('./actions')
    expect(actions).not.toHaveProperty('selectProposalMaintenance')
  })

  it('accepts options without contracting an unconfirmed legacy maintenance selection', async () => {
    state.fetchResult = {
      data: {
        id: 'p5',
        status: 'sent',
        client_id: 'c1',
        clients: COMPLETE_CLIENT,
        maintenance_options: DEFAULT_MAINTENANCE_OFFER,
        maintenance_selected_plan_id: 'essential',
      },
      error: null,
    }

    await expect(acceptProposal(VALID_TOKEN, SIGNATURE)).resolves.toEqual({ ok: true })
    expect(state.lastPatch).toMatchObject({
      maintenance_selected_plan_id: null,
      maintenance_selection_source: null,
      maintenance_selected_at: null,
    })
    expect(state.lastRpc?.args.p_document_snapshot).toMatchObject({
      proposal: {
        maintenance_options: DEFAULT_MAINTENANCE_OFFER,
        maintenance_selected_plan_id: null,
      },
    })
  })

  it('does not sign if an unconfirmed legacy maintenance choice cannot be cleared', async () => {
    state.fetchResult = {
      data: {
        id: 'p5',
        status: 'sent',
        client_id: 'c1',
        clients: COMPLETE_CLIENT,
        maintenance_selected_plan_id: 'growth',
      },
      error: null,
    }
    state.updateResult = { error: { message: 'db down' } }
    await expect(acceptProposal(VALID_TOKEN, SIGNATURE)).resolves.toEqual({
      ok: false,
      error: 'No se pudo preparar la firma de la propuesta',
    })
    expect(state.lastRpc).toBeNull()
    expect(createProposalDraftInvoices).not.toHaveBeenCalled()
  })

  it('creates exactly the agreed deposit through the atomic payment RPC', async () => {
    state.fetchResult = {
      data: {
        id: '494d62cb-fd56-4650-b131-9e3a927a20ad',
        status: 'accepted',
        total: 1_000,
        payment_schedule: 'half_half',
      },
      error: null,
    }
    state.rpcResult = { data: [{ redsys_order: '1234567890' }], error: null }

    await expect(
      initiateProposalPayment('494d62cb-fd56-4650-b131-9e3a927a20ad', VALID_TOKEN),
    ).resolves.toMatchObject({ ok: true, url: 'https://redsys.example.test' })
    expect(state.lastRpc).toEqual({
      name: 'create_proposal_deposit_payment',
      args: { p_proposal_id: '494d62cb-fd56-4650-b131-9e3a927a20ad', p_amount: 500 },
    })
    expect(createRedsysPayment).toHaveBeenCalledWith(
      expect.objectContaining({ Ds_Merchant_Amount: '50000', Ds_Merchant_Order: '1234567890' }),
    )
  })

  it('returns the atomic duplicate-deposit error without creating a gateway request', async () => {
    state.fetchResult = {
      data: {
        id: '494d62cb-fd56-4650-b131-9e3a927a20ad',
        status: 'accepted',
        total: 1_000,
        payment_schedule: 'half_half',
      },
      error: null,
    }
    state.rpcResult = {
      error: { message: 'Ya existe un pago de señal pendiente o confirmado' },
    }

    await expect(
      initiateProposalPayment('494d62cb-fd56-4650-b131-9e3a927a20ad', VALID_TOKEN),
    ).resolves.toEqual({ ok: false, error: 'Ya existe un pago de señal pendiente o confirmado' })
    expect(createRedsysPayment).not.toHaveBeenCalled()
  })

  it('charges the first-milestone invoice total and refuses when it cannot be prepared', async () => {
    state.fetchResult = {
      data: {
        id: '494d62cb-fd56-4650-b131-9e3a927a20ad',
        status: 'accepted',
        total: 1_000,
        payment_schedule: 'half_half',
      },
      error: null,
    }
    state.rpcResult = { data: [{ redsys_order: '1234567890' }], error: null }
    createDepositInvoice.mockResolvedValueOnce({
      ok: true,
      invoiceId: 'inv-1',
      total: 500.01,
      status: 'issued',
    })
    await initiateProposalPayment('494d62cb-fd56-4650-b131-9e3a927a20ad', VALID_TOKEN)
    expect(state.lastRpc?.args).toMatchObject({ p_amount: 500.01 })

    state.lastRpc = null
    createDepositInvoice.mockResolvedValueOnce({ ok: false, error: 'sin cliente' })
    await expect(
      initiateProposalPayment('494d62cb-fd56-4650-b131-9e3a927a20ad', VALID_TOKEN),
    ).resolves.toEqual({ ok: false, error: 'No se pudo preparar la factura del primer plazo' })
    expect(state.lastRpc).toBeNull()
  })

  it('does not create a deposit when Redsys is unavailable', async () => {
    assertRedsysConfigured.mockImplementationOnce(() => {
      throw new Error('missing Redsys configuration')
    })

    await expect(
      initiateProposalPayment('494d62cb-fd56-4650-b131-9e3a927a20ad', VALID_TOKEN),
    ).resolves.toEqual({
      ok: false,
      error: 'El pago electrónico no está disponible temporalmente',
    })
    expect(state.lastRpc).toBeNull()
  })
})
