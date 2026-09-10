import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

const {
  createProposalDraftInvoices,
  createRedsysPayment,
  isPortalUnlocked,
  sendProposalAcceptedEmail,
} = vi.hoisted(() => ({
  createProposalDraftInvoices: vi.fn(async () => ({ ids: [], created: 0 })),
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
vi.mock('@/lib/invoices/proposal-drafts', () => ({ createProposalDraftInvoices }))
vi.mock('@/lib/integrations/send-proposal-accepted-email', () => ({ sendProposalAcceptedEmail }))
vi.mock('@/lib/integrations/redsys', () => ({
  createRedsysPayment,
  getRedsysUrl: () => 'https://redsys.example.test',
}))
vi.mock('@/lib/portal/access', () => ({
  isPortalUnlocked,
  unlockPortalResource: vi.fn(),
}))

type ProposalRow = {
  id: string
  status: string
  valid_until?: string | null
  is_client_visible?: boolean | null
  portal_password_hash?: string | null
  total?: number
  payment_schedule?: string
  maintenance_options?: unknown
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
        maybeSingle: async () => (isPrimary ? state.fetchResult : empty),
        single: async () => empty,
        insert: () => chain,
        update: (patch: Record<string, unknown>) => {
          state.lastPatch = patch
          return {
            eq: async (_col: string, id: string) => {
              state.lastUpdateId = id
              return state.updateResult
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
} as const

// A client row with the minimum fiscal data so `acceptWithFiscal` skips the
// fiscal-form requirement and exercises the electronic acceptance flow.
const COMPLETE_CLIENT = {
  name: 'Acme SL',
  nif: 'B12345678',
  billing_address_street: 'Calle Mayor 1, Madrid',
}

let acceptProposal: typeof import('./actions').acceptProposal
let initiateProposalPayment: typeof import('./actions').initiateProposalPayment
let rejectProposal: typeof import('./actions').rejectProposal
let selectProposalMaintenance: typeof import('./actions').selectProposalMaintenance
let sendProposalQuestion: typeof import('./actions').sendProposalQuestion

beforeAll(async () => {
  const actions = await import('./actions')
  acceptProposal = actions.acceptProposal
  initiateProposalPayment = actions.initiateProposalPayment
  rejectProposal = actions.rejectProposal
  selectProposalMaintenance = actions.selectProposalMaintenance
  sendProposalQuestion = actions.sendProposalQuestion
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

    await expect(sendProposalQuestion('short', '¿Incluye soporte?')).resolves.toEqual({
      ok: false,
      error: 'La consulta no es válida',
    })
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
    await expect(selectProposalMaintenance(VALID_TOKEN, 'growth')).resolves.toEqual({
      ok: false,
      error: 'Vuelve a introducir la contraseña del portal',
    })
    await expect(sendProposalQuestion(VALID_TOKEN, '¿Incluye soporte?')).resolves.toEqual({
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
    expect(state.lastRpc?.name).toBe('accept_proposal_with_evidence')
    expect(state.lastRpc?.args).toMatchObject({
      p_proposal_id: 'p1',
      p_signer_name: 'Ana Gómez',
      p_evidence_version: 'doscientos-proposal-acceptance-v2',
      p_document_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(createProposalDraftInvoices).toHaveBeenCalledWith(expect.anything(), 'p1', null)
    expect(revalidatePath).toHaveBeenCalledWith(`/p/proposal/${VALID_TOKEN}`)
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

  it('rejects maintenance selection when the offer is disabled', async () => {
    state.fetchResult = {
      data: {
        id: 'p5',
        status: 'sent',
        maintenance_options: { ...DEFAULT_MAINTENANCE_OFFER, enabled: false },
      },
      error: null,
    }

    await expect(selectProposalMaintenance(VALID_TOKEN, null)).resolves.toEqual({
      ok: false,
      error: 'El mantenimiento no está disponible en esta propuesta',
    })
    expect(state.lastPatch).toBeNull()
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
})
