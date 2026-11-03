'use server'

import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { isAIEnabled } from '@/lib/env'
import type { CallWorkspaceData } from '@/lib/leads/call-briefing'
import { getLeadDetail } from '@/lib/leads/queries'
import { can } from '@/lib/permissions'
import { createServerClient } from '@/lib/supabase/server'

const Input = z.object({ leadId: z.string().uuid() })

/** Read-only. Uses the signed-in user's RLS, never the public mobile token or admin client. */
export const getLeadCallBriefing = defineAction<typeof Input, CallWorkspaceData>({
  name: 'leads.getCallBriefing',
  schema: Input,
  handler: async ({ leadId }, { user }) => {
    if (!can(user.role, 'leads.read')) throw new Error('Sin permiso para consultar leads.')
    const prices = can(user.role, 'proposals.prices')
    const finance = can(user.role, 'finance.read')
    const detail = await getLeadDetail(leadId, { includeProposalPrices: prices })
    if (!detail) throw new Error('Lead no encontrado.')
    const { lead } = detail
    const invoices = detail.invoices.filter(
      (invoice) => !['draft', 'cancelled', 'rectified'].includes(invoice.status ?? ''),
    )
    let paidTotal: number | null = null
    let outstandingTotal: number | null = null
    if (finance) {
      const db = await createServerClient()
      const { data: payments, error } = invoices.length
        ? await db
            .from('invoice_payments')
            .select('invoice_id, amount')
            .in(
              'invoice_id',
              invoices.map((invoice) => invoice.id),
            )
            .eq('status', 'confirmed')
        : { data: [], error: null }
      if (error) throw new Error('No se pudo cargar el resumen de cobros.')
      const paid = new Map<string, number>()
      for (const payment of payments ?? []) {
        paid.set(payment.invoice_id, (paid.get(payment.invoice_id) ?? 0) + Number(payment.amount))
      }
      paidTotal = invoices.reduce((sum, invoice) => sum + (paid.get(invoice.id) ?? 0), 0)
      outstandingTotal = invoices.some((invoice) => invoice.total == null)
        ? null
        : invoices.reduce(
            (sum, invoice) =>
              sum + Math.max(0, Number(invoice.total) - (paid.get(invoice.id) ?? 0)),
            0,
          )
    }
    return {
      aiEnabled: isAIEnabled(),
      briefing: {
        name: lead.alias?.trim() || lead.name,
        company: lead.company,
        leadStatus: lead.status,
        estimatedValue: prices ? lead.estimated_value : null,
        summary: (lead.ai_summary || lead.notes)?.slice(0, 2000) ?? null,
        summaryOrigin: lead.ai_summary ? 'ai' : lead.notes ? 'notes' : null,
        solutionType: lead.solution_type,
        urgency: lead.urgency,
        questions: detail.discoveryQuestions
          .filter((question) => ['open', 'needs_review', 'deferred'].includes(question.status))
          .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order)
          .slice(0, 5)
          .map(({ question, status, rationale }) => ({ question, status, rationale })),
        proposals: detail.proposals.slice(0, 3).map((proposal) => ({
          title: proposal.title || 'Propuesta',
          status: proposal.status || 'Sin estado',
          total: prices ? proposal.total : null,
        })),
        invoiceCount: finance ? invoices.length : null,
        paidTotal,
        outstandingTotal,
      },
    }
  },
})
