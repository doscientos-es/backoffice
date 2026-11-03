import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getLeadCallBriefing } from './call-workspace-actions'

const { requireUser, getLeadDetail, from, paymentStatus } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getLeadDetail: vi.fn(),
  from: vi.fn(),
  paymentStatus: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireUser, requireRole: vi.fn() }))
vi.mock('@/lib/env', () => ({ isAIEnabled: () => true }))
vi.mock('@/lib/leads/queries', () => ({ getLeadDetail }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from }) }))

const input = { leadId: '00000000-0000-4000-8000-000000000001' }
const detail = {
  lead: {
    name: 'Synthetic lead',
    alias: null,
    company: null,
    status: 'qualified',
    estimated_value: 4000,
    ai_summary: 'Resumen sintético',
    notes: 'Notas sintéticas',
    solution_type: 'Web',
    urgency: 'Este mes',
  },
  proposals: [{ title: 'Propuesta sintética', status: 'sent', total: 3000 }],
  invoices: [
    { id: 'issued', status: 'sent', total: 1000 },
    { id: 'draft', status: 'draft', total: 9000 },
    { id: 'cancelled', status: 'cancelled', total: 5000 },
  ],
  discoveryQuestions: [
    { question: 'Resuelta', status: 'answered', priority: 1, sort_order: 0 },
    { question: 'Después', status: 'deferred', priority: 3, sort_order: 0 },
    { question: 'Primero', status: 'open', priority: 1, sort_order: 1 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'synthetic-user', role: 'owner' })
  getLeadDetail.mockResolvedValue(detail)
  from.mockReturnValue({ select: () => ({ in: () => ({ eq: paymentStatus }) }) })
  paymentStatus.mockResolvedValue({ data: [{ invoice_id: 'issued', amount: 250 }], error: null })
})

describe('call briefing access', () => {
  it('uses user-scoped detail and confirmed payments, excluding unissued invoices', async () => {
    expect(await getLeadCallBriefing(input)).toMatchObject({
      ok: true,
      aiEnabled: true,
      briefing: {
        summary: 'Resumen sintético',
        summaryOrigin: 'ai',
        invoiceCount: 1,
        paidTotal: 250,
        outstandingTotal: 750,
        questions: [{ question: 'Primero' }, { question: 'Después' }],
      },
    })
    expect(getLeadDetail).toHaveBeenCalledWith(input.leadId, { includeProposalPrices: true })
    expect(from).toHaveBeenCalledWith('invoice_payments')
    expect(paymentStatus).toHaveBeenCalledWith('status', 'confirmed')
  })

  it('never serializes prices or finances for viewers, even if upstream returns them', async () => {
    requireUser.mockResolvedValue({ id: 'synthetic-user', role: 'viewer' })
    expect(await getLeadCallBriefing(input)).toMatchObject({
      ok: true,
      briefing: {
        estimatedValue: null,
        invoiceCount: null,
        paidTotal: null,
        outstandingTotal: null,
        proposals: [{ total: null }],
      },
    })
    expect(getLeadDetail).toHaveBeenCalledWith(input.leadId, { includeProposalPrices: false })
    expect(from).not.toHaveBeenCalled()
  })

  it('does not query without authentication, lead permission or valid input', async () => {
    requireUser.mockRejectedValueOnce(new Error('Unauthorized'))
    expect((await getLeadCallBriefing(input)).ok).toBe(false)
    requireUser.mockResolvedValue({ id: 'synthetic-user', role: 'accountant' })
    expect((await getLeadCallBriefing(input)).ok).toBe(false)
    expect((await getLeadCallBriefing({ leadId: 'invalid' })).ok).toBe(false)
    expect(getLeadDetail).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('does not return a briefing for a lead hidden by RLS or a failed payment query', async () => {
    getLeadDetail.mockResolvedValueOnce(null)
    expect((await getLeadCallBriefing(input)).ok).toBe(false)
    paymentStatus.mockResolvedValue({ data: null, error: { code: '42501' } })
    expect(await getLeadCallBriefing(input)).toMatchObject({ ok: false, error: expect.any(String) })
  })
})
