import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

const state = vi.hoisted(() => ({
  isTeam: false,
  role: 'admin',
  mfa: true,
  accessible: true,
  unlocked: true,
  proposal: null as Record<string, unknown> | null,
  items: [] as Array<Record<string, unknown>>,
  settings: null as Record<string, unknown> | null,
  acceptance: null as Record<string, unknown> | null,
}))
const renderProposalPdf = vi.hoisted(() => vi.fn(async () => Buffer.from('pdf-content')))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () =>
    state.isTeam ? { ok: true, user: { id: 'member-1', role: state.role } } : { ok: false },
  hasMfaAccess: async () => state.mfa,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => ({ data: state.accessible ? { id: 'proposal-1' } : null }),
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/portal/access', () => ({ isPortalUnlocked: async () => state.unlocked }))
vi.mock('@/lib/proposals/engagement', () => ({ recordProposalEngagement: vi.fn() }))
// `after` only works inside a real request scope; run the callback inline here.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => void task(),
}))
vi.mock('@/lib/proposals/proposal-pdf-document', () => ({
  proposalPdfFilename: (number: string | null, id: string) => `propuesta-${number ?? id}.pdf`,
  renderProposalPdf,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const result =
        {
          proposals: state.proposal,
          proposal_acceptances: state.acceptance,
          proposal_items: state.items,
          settings: state.settings,
        }[table] ?? null
      const filters: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters[column] = value
          return chain
        },
        is: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data:
            table === 'proposal_acceptances' &&
            ((filters.accepted_at !== undefined &&
              filters.accepted_at !== state.acceptance?.accepted_at) ||
              (filters.id !== undefined && filters.id !== state.acceptance?.id) ||
              (filters.proposal_id !== undefined &&
                state.acceptance?.proposal_id !== undefined &&
                filters.proposal_id !== state.acceptance?.proposal_id))
              ? null
              : result,
          error: null,
        }),
        then: <T>(onfulfilled?: (value: { data: unknown; error: null }) => T) =>
          Promise.resolve({ data: result, error: null }).then(onfulfilled),
      }
      return chain
    },
  }),
}))

const TOKEN = 'a'.repeat(48)
const context = { params: Promise.resolve({ token: TOKEN }) }

function request(search = '') {
  return new NextRequest(`https://app.example.test/p/proposal/${TOKEN}/pdf${search}`)
}

describe('GET /p/proposal/[token]/pdf', () => {
  beforeEach(() => {
    state.isTeam = false
    state.role = 'admin'
    state.mfa = true
    state.accessible = true
    state.unlocked = true
    state.items = []
    state.settings = { company_name: 'doscientos', company_nif: 'B12345678', iban: 'ES00' }
    state.acceptance = null
    renderProposalPdf.mockClear()
    state.proposal = {
      id: 'proposal-1',
      status: 'sent',
      title: 'Automatización comercial',
      number: 'P-001',
      subtotal: 1000,
      tax_amount: 210,
      total: 1210,
      clients: { name: 'Acme SL' },
      leads: null,
    }
  })

  it('keeps draft PDFs private to team members', async () => {
    const { GET } = await import('./route')
    state.proposal = { ...state.proposal, status: 'draft' }

    const response = await GET(request(), context)

    expect(response.status).toBe(404)
  })

  it('redirects a password-locked client to the proposal portal', async () => {
    const { GET } = await import('./route')
    state.unlocked = false

    const response = await GET(request(), context)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(`https://app.example.test/p/proposal/${TOKEN}`)
  })

  it('returns the attachment to a team member previewing a draft', async () => {
    const { GET } = await import('./route')
    state.isTeam = true
    state.proposal = { ...state.proposal, status: 'draft' }
    state.items = [
      {
        id: 'item-1',
        description: 'Implementación',
        quantity: 1,
        unit_price: 1000,
        vat_rate: 21,
        subtotal: 1000,
        billing_cycle: 'none',
      },
    ]

    const response = await GET(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('propuesta-P-001.pdf')
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        maintenanceOffer: expect.objectContaining({ plans: expect.any(Array) }),
      }),
    )
  })

  it('does not add unsigned maintenance options or a legacy choice to the quoted items', async () => {
    const { GET } = await import('./route')
    state.proposal = {
      ...state.proposal,
      maintenance_options: DEFAULT_MAINTENANCE_OFFER,
      maintenance_selected_plan_id: 'growth',
    }
    await GET(request(), context)
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({ maintenanceOffer: DEFAULT_MAINTENANCE_OFFER, items: [] }),
    )
  })

  it('preserves maintenance already contracted in a historical signed snapshot', async () => {
    const { GET } = await import('./route')
    state.proposal = {
      ...state.proposal,
      status: 'accepted',
      responded_at: '2026-09-10T12:34:56.000Z',
    }
    state.acceptance = {
      accepted_at: '2026-09-10T12:34:56.000Z',
      document_snapshot: {
        proposal: {
          maintenance_options: DEFAULT_MAINTENANCE_OFFER,
          maintenance_selected_plan_id: 'growth',
          items: [],
        },
      },
    }
    await GET(request(), context)
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ description: 'Mantenimiento web · Crecimiento' })],
      }),
    )
  })

  it('renders the signed document snapshot and signature evidence', async () => {
    const { GET } = await import('./route')
    state.proposal = {
      ...state.proposal,
      status: 'accepted',
      title: 'Título modificado',
      responded_at: '2026-09-10T12:34:56.000Z',
    }
    state.items = [
      {
        id: 'item-current',
        description: 'Concepto modificado',
        quantity: 1,
        unit_price: 5000,
        vat_rate: 21,
        subtotal: 5000,
        billing_cycle: 'none',
      },
    ]
    state.acceptance = {
      signer_name: 'Ana Gómez',
      signer_role: 'Administradora',
      accepted_at: '2026-09-10T12:34:56.000Z',
      document_hash: 'a'.repeat(64),
      consent_text: 'Acepto la propuesta y solicito inicio anticipado.',
      document_snapshot: {
        parties: {
          provider: { name: 'doscientos', nif: 'B12345678', address: 'Barcelona' },
          client: { name: 'Acme SL', nif: 'B22222222', address: 'Madrid' },
        },
        contract: { client_capacity: 'consumer', consumer_early_start_requested: true },
        handwritten_signature: {
          version: 1,
          strokes: [
            [
              { x: 10, y: 20 },
              { x: 30, y: 40 },
            ],
          ],
        },
        proposal: {
          number: 'P-001',
          title: 'Título firmado',
          currency: 'EUR',
          subtotal: 1000,
          tax_amount: 210,
          total: 1210,
          items: [
            {
              id: 'item-signed',
              description: 'Implementación firmada',
              quantity: 1,
              unit_price: 1000,
              vat_rate: 21,
              subtotal: 1000,
              billing_cycle: 'none',
            },
          ],
          terms: 'Condiciones firmadas',
        },
        fiscal_data: { name: 'Acme SL' },
      },
    }

    const response = await GET(request(), context)

    expect(response.status).toBe(200)
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Título firmado',
        recipientName: 'Acme SL',
        recipientNif: 'B22222222',
        recipientAddress: 'Madrid',
        companyName: 'doscientos',
        companyNif: 'B12345678',
        companyAddress: 'Barcelona',
        legalTerms: 'Condiciones firmadas',
        items: [expect.objectContaining({ description: 'Implementación firmada' })],
        acceptance: {
          signerName: 'Ana Gómez',
          signerRole: 'Administradora',
          acceptedAt: '2026-09-10T12:34:56.000Z',
          documentHash: 'a'.repeat(64),
          consentText: 'Acepto la propuesta y solicito inicio anticipado.',
          clientCapacity: 'consumer',
          consumerEarlyStartRequested: true,
          handwrittenSignature: {
            version: 1,
            strokes: [
              [
                { x: 10, y: 20 },
                { x: 30, y: 40 },
              ],
            ],
          },
        },
      }),
    )
  })

  it('does not reuse a previous acceptance for a new manually accepted response', async () => {
    const { GET } = await import('./route')
    state.proposal = {
      ...state.proposal,
      status: 'accepted',
      responded_at: '2026-09-12T12:00:00.000Z',
    }
    state.acceptance = {
      accepted_at: '2026-09-10T12:34:56.000Z',
      document_snapshot: { proposal: { title: 'Versión anterior', items: [] } },
    }

    await GET(request(), context)

    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Automatización comercial',
        acceptance: null,
        acceptedWithoutSignature: true,
      }),
    )
  })

  it('does not use a previous signed snapshot while a proposal is open for response', async () => {
    const { GET } = await import('./route')
    state.acceptance = {
      accepted_at: '2026-09-10T12:34:56.000Z',
      document_snapshot: { proposal: { title: 'Versión anterior', items: [] } },
    }

    await GET(request(), context)

    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Automatización comercial', acceptance: null }),
    )
  })

  it('keeps historical acceptances unavailable to clients, non-admins and unverified admins', async () => {
    const { GET } = await import('./route')
    const historicalRequest = request('?acceptance=acceptance-1')
    expect((await GET(historicalRequest, context)).status).toBe(404)
    state.isTeam = true
    state.role = 'member'
    expect((await GET(historicalRequest, context)).status).toBe(404)
    state.role = 'admin'
    state.mfa = false
    expect((await GET(historicalRequest, context)).status).toBe(404)
    state.mfa = true
    state.accessible = false
    expect((await GET(historicalRequest, context)).status).toBe(404)
    expect(renderProposalPdf).not.toHaveBeenCalled()
  })

  it('renders a historical signed snapshot for an authorized admin without changing the public PDF', async () => {
    const { GET } = await import('./route')
    state.isTeam = true
    state.acceptance = {
      id: 'acceptance-1',
      proposal_id: 'proposal-1',
      signer_name: 'Ejemplo',
      accepted_at: '2026-09-10T12:34:56.000Z',
      document_hash: 'a'.repeat(64),
      document_snapshot: { proposal: { title: 'Versión anterior', items: [] } },
    }
    expect((await GET(request('?acceptance=acceptance-1'), context)).status).toBe(200)
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Versión anterior',
        acceptance: expect.objectContaining({ signerName: 'Ejemplo' }),
      }),
    )
    await GET(request(), context)
    expect(renderProposalPdf).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Automatización comercial', acceptance: null }),
    )
  })

  it('rejects evidence from another proposal or without a complete snapshot', async () => {
    const { GET } = await import('./route')
    state.isTeam = true
    state.acceptance = { id: 'acceptance-1', proposal_id: 'other', document_snapshot: {} }
    expect((await GET(request('?acceptance=acceptance-1'), context)).status).toBe(404)
    state.acceptance = { id: 'acceptance-1', proposal_id: 'proposal-1', document_snapshot: {} }
    expect((await GET(request('?acceptance=acceptance-1'), context)).status).toBe(404)
    expect(renderProposalPdf).not.toHaveBeenCalled()
  })
})
