import 'server-only'
import { effectivePaymentPlan } from '@/lib/proposals/scope'
import type { createAdminClient } from '@/lib/supabase/admin'

import { createProposalDraftInvoices } from './proposal-drafts'

type AdminClient = ReturnType<typeof createAdminClient>

type DepositInvoiceResult =
  | { ok: true; invoiceId: string; total: number; status: string }
  | { ok: false; error: string }

/**
 * Resolves the invoice of the first billing milestone (señal/anticipo) of an
 * accepted proposal, creating the missing milestone drafts idempotently. The
 * deposit is always charged and invoiced with the same lines, VAT and total.
 */
export async function createDepositInvoice(
  supabase: AdminClient,
  proposalId: string,
): Promise<DepositInvoiceResult> {
  try {
    await createProposalDraftInvoices(supabase, proposalId, null)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo preparar la factura de anticipo',
    }
  }

  const { data: proposal } = await supabase
    .from('proposals')
    .select('payment_plan, payment_schedule')
    .eq('id', proposalId)
    .maybeSingle()
  const firstMilestone = proposal
    ? effectivePaymentPlan(proposal.payment_plan, proposal.payment_schedule)[0]
    : undefined
  if (!firstMilestone) return { ok: false, error: 'Propuesta no encontrada' }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, total, status')
    .eq('proposal_id', proposalId)
    .eq('proposal_payment_plan_item_id', firstMilestone.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !invoice) {
    return { ok: false, error: error?.message ?? 'No se encontró la factura de anticipo' }
  }
  if (['cancelled', 'rectified'].includes(invoice.status as string)) {
    return { ok: false, error: 'La factura de anticipo está anulada o rectificada' }
  }

  return {
    ok: true,
    invoiceId: invoice.id as string,
    total: Number(invoice.total),
    status: invoice.status as string,
  }
}
