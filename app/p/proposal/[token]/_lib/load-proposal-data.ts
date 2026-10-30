import { effectivePaymentPlan } from '@/lib/proposals/scope'
import { createAdminClient } from '@/lib/supabase/admin'

type ProposalRow = Record<string, unknown> & { id: unknown }

/**
 * Independent reads for the portal page, fetched in parallel instead of one
 * round-trip each. All of them run with the admin client (public visitors).
 */
export async function loadProposalData(proposal: ProposalRow) {
  const admin = createAdminClient()
  const proposalId = proposal.id as string

  const [
    { data: items },
    { data: specs },
    { data: messages },
    { data: settings },
    { data: payments },
    { data: depositInvoice },
    { data: contact },
  ] = await Promise.all([
    admin
      .from('proposal_items')
      .select(
        'id, position, description, quantity, unit_price, vat_rate, subtotal, billing_cycle, discount_percent, discount_reason',
      )
      .eq('proposal_id', proposalId)
      .order('position'),
    admin
      .from('proposal_specs')
      .select('id, title, portal_token')
      .eq('proposal_id', proposalId)
      .eq('is_client_visible', true)
      .not('portal_token', 'is', null),
    admin
      .from('proposal_messages')
      .select('id, author_type, author_name, body, created_at')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true }),
    admin.from('settings').select('company_name, iban').eq('id', 1).maybeSingle(),
    // Confirmed payments for this proposal (signal/deposit)
    admin
      .from('invoice_payments')
      .select('id, amount, status, created_at')
      .eq('proposal_id', proposalId)
      .eq('status', 'confirmed'),
    // First-milestone invoice: the deposit is charged for exactly its total
    admin
      .from('invoices')
      .select('total')
      .eq('proposal_id', proposalId)
      .eq(
        'proposal_payment_plan_item_id',
        effectivePaymentPlan(proposal.payment_plan, proposal.payment_schedule)[0]?.id ?? '',
      )
      .is('deleted_at', null)
      .maybeSingle(),
    // Whoever prepared the proposal is the human contact shown to the lead.
    typeof proposal.created_by === 'string'
      ? admin
          .from('team_members')
          .select('name, email, avatar_url')
          .eq('id', proposal.created_by)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return { items, specs, messages, settings, payments, depositInvoice, contact }
}
