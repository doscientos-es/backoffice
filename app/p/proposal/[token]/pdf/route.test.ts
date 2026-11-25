import type * as NextServer from 'next/server'
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
  revision: null as Record<string, unknown> | null,
}))
const renderProposalPdf = vi.hoisted(() => vi.fn(async () => Buffer.from('pdf-content')))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () =>
    state.isTeam ? { ok: true, user: { id: 'member-1', role: state.role } } : { ok: false },
  hasMfaAccess: async () => state.mfa,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters[column] = value
          return chain
        },
        is: () => chain,
        maybeSingle: async () => ({
          data: !state.accessible
            ? null
            : table === 'proposal_revisions'
              ? filters.id === state.revision?.id &&
                filters.proposal_id === state.revision?.proposal_id
                ? state.revision
                : null
              : { id: 'proposal-1' },
        }),
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/portal/access', () => ({ isPortalUnlocked: async () => state.unlocked }))
vi.mock('@/lib/proposals/engagement', () => ({ recordProposalEngagement: vi.fn() }))
// `after` only works inside a real request scope; run the callback inline here.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: (task: () => unknown) => void task(),
}))
vi.mock('@/lib/proposals/proposal-pdf-document', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/proposals/proposal-pdf-document')>()),
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
    state.revision = null
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

  it('preserves the requested language when a PDF requires unlocking', async () => {
    const { GET } = await import('./route')
    state.unlocked = false
    const response = await GET(request('?lang=en'), context)
    expect(response.headers.get('location')).toBe(
      `https://app.example.test/p/proposal/${TOKEN}?lang=en`,
    )
  })

  it('uses the requested language in preference to the lead language', async () => {
    const { GET } = await import('./route')
    state.proposal = { ...state.proposal, leads: { language: 'ca' } }
    await GET(request('?lang=en'), context)
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'en',
        canAccept: true,
        portalUrl: expect.stringContaining(`/p/proposal/${TOKEN}?lang=en`),
      }),
    )
    await GET(request(), context)
    expect(renderProposalPdf).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'ca' }))
  })

  it('allows the QR on the last day of validity for a viewed proposal', async () => {
    const { GET } = await import('./route')
    state.proposal = {
      ...state.proposal,
      status: 'viewed',
      valid_until: new Date().toISOString().slice(0, 10),
    }
    await GET(request(), context)
    expect(renderProposalPdf).toHaveBeenCalledWith(expect.objectContaining({ canAccept: true }))
  })

  it.each([
    ['expired by date', { valid_until: '2000-01-01' }],
    ['marked as expired', { status: 'expired' }],
    ['rejected', { status: 'rejected' }],
    ['hidden from the client', { is_client_visible: false }],
  ])('omits the acceptance QR when the proposal is %s', async (_, override) => {
    const { GET } = await import('./route')
    state.isTeam = true
    state.proposal = { ...state.proposal, ...override }
    expect((await GET(request(), context)).status).toBe(200)
    expect(renderProposalPdf).toHaveBeenCalledWith(expect.objectContaining({ canAccept: false }))
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
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="Automatizacion-comercial-Acme-SL-doscientos.pdf"',
    )
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        canAccept: false,
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
      clients: { name: 'Cliente modificado' },
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
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="Titulo-firmado-Acme-SL-doscientos.pdf"',
    )
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Título firmado',
        canAccept: false,
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

  it('uses only the signature captured in each document, never a newer live signature', async () => {
    const { GET } = await import('./route')
    const signature = (name: string) => ({
      member_id: '00000000-0000-4000-8000-000000000001',
      name,
      job_title: null,
      drawing: { version: 1, strokes: [[{ x: 10, y: 20 }]] },
    })
    state.proposal = { ...state.proposal, provider_signature: signature('Actual') }
    await GET(request(), context)
    expect(renderProposalPdf).toHaveBeenLastCalledWith(
      expect.objectContaining({
        providerSignature: signature('Actual'),
      }),
    )

    state.isTeam = true
    state.acceptance = {
      id: 'acceptance-1',
      proposal_id: 'proposal-1',
      signer_name: 'Cliente',
      accepted_at: '2026-09-10T12:34:56.000Z',
      document_snapshot: { proposal: { items: [] }, provider_signature: signature('Anterior') },
    }
    await GET(request('?acceptance=acceptance-1'), context)
    expect(renderProposalPdf).toHaveBeenLastCalledWith(
      expect.objectContaining({
        providerSignature: signature('Anterior'),
      }),
    )
    state.acceptance.document_snapshot = { proposal: { items: [] } }
    await GET(request('?acceptance=acceptance-1'), context)
    expect(renderProposalPdf).toHaveBeenLastCalledWith(
      expect.objectContaining({
        providerSignature: null,
      }),
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
      document_snapshot: {
        proposal: {
          title: 'Versión anterior',
          items: [
            {
              id: 'annual',
              description: 'Servicio anual',
              quantity: 1,
              unit_price: 100,
              vat_rate: 21,
              billing_cycle: 'yearly',
            },
          ],
        },
      },
    }
    expect((await GET(request('?acceptance=acceptance-1'), context)).status).toBe(200)
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Versión anterior',
        iban: null,
        recipientName: 'Cliente',
        companyName: null,
        companyNif: null,
        paymentTerms: null,
        legalTerms: '',
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
    state.proposal = {
      ...state.proposal,
      status: 'accepted',
      responded_at: '2026-09-10T12:34:56.000Z',
    }
    state.acceptance.accepted_at = '2026-09-10T12:34:56.000Z'
    expect((await GET(request(), context)).status).toBe(404)
    expect(renderProposalPdf).not.toHaveBeenCalled()
  })

  it('only lets authorized admins read an archived revision belonging to the proposal', async () => {
    const { GET } = await import('./route')
    state.revision = {
      id: 'revision-1',
      proposal_id: 'other',
      snapshot: { proposal: {}, items: [] },
    }
    expect((await GET(request('?revision=revision-1'), context)).status).toBe(404)
    state.isTeam = true
    state.role = 'member'
    expect((await GET(request('?revision=revision-1'), context)).status).toBe(404)
    state.role = 'admin'
    state.mfa = false
    expect((await GET(request('?revision=revision-1'), context)).status).toBe(404)
    state.mfa = true
    expect((await GET(request('?revision=revision-1'), context)).status).toBe(404)
    expect((await GET(request('?revision=revision-1&acceptance=a'), context)).status).toBe(404)
    expect(renderProposalPdf).not.toHaveBeenCalled()
  })

  it('reconstructs a rejected revision exclusively from its archived data', async () => {
    const { GET } = await import('./route')
    state.isTeam = true
    state.revision = {
      id: 'revision-1',
      proposal_id: 'proposal-1',
      snapshot: {
        proposal: {
          status: 'rejected',
          title: 'Anterior',
          subtotal: 100,
          tax_amount: 21,
          total: 121,
          payment_terms: 'A 30 días',
        },
        items: [
          {
            id: 'old-item',
            description: 'Original',
            quantity: 1,
            unit_price: 100,
            vat_rate: 21,
            billing_cycle: 'none',
          },
        ],
        recipient: { name: 'Cliente anterior', nif: 'X123', street: 'Calle anterior' },
        provider: { name: 'Proveedor anterior', nif: 'Y456', iban: 'ES01', city: 'Madrid' },
      },
    }
    const response = await GET(request('?revision=revision-1'), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="Anterior-Cliente-anterior-doscientos.pdf"',
    )
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Anterior',
        canAccept: false,
        total: 121,
        recipientName: 'Cliente anterior',
        recipientNif: 'X123',
        recipientAddress: 'Calle anterior',
        companyName: 'Proveedor anterior',
        companyNif: 'Y456',
        companyAddress: 'Madrid',
        iban: 'ES01',
        paymentTerms: 'A 30 días',
        acceptance: null,
        items: [expect.objectContaining({ description: 'Original' })],
      }),
    )
    await GET(request(), context)
    expect(renderProposalPdf).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Automatización comercial',
        recipientName: 'Acme SL',
      }),
    )
  })

  it('uses the acceptance evidence tied to an archived accepted revision', async () => {
    const { GET } = await import('./route')
    state.isTeam = true
    state.revision = {
      id: 'revision-1',
      proposal_id: 'proposal-1',
      snapshot: {
        proposal: {
          status: 'accepted',
          responded_at: '2026-09-10T12:34:56.000Z',
          title: 'Archivada',
        },
        items: [],
      },
    }
    state.acceptance = {
      accepted_at: '2026-09-10T12:34:56.000Z',
      signer_name: 'Ejemplo',
      document_snapshot: { proposal: { title: 'Firmada', items: [] } },
    }
    expect((await GET(request('?revision=revision-1'), context)).status).toBe(200)
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Firmada',
        acceptance: expect.objectContaining({ signerName: 'Ejemplo' }),
      }),
    )
  })
})
