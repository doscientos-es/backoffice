import { effectivePaymentPlan } from '@/lib/proposals/scope'
import { createAdminClient } from '@/lib/supabase/admin'

import type { ProposalTeamMember } from './types'

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
    { data: settings },
    { data: payments },
    { data: depositInvoice },
    { data: contact },
    { data: assignedTeam },
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
          .select('name, email')
          .eq('id', proposal.created_by)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('proposal_team_members')
      .select('team_members!inner(id, name, job_title, avatar_url, contact_email, email_alias)')
      .eq('proposal_id', proposalId)
      .is('team_members.deleted_at', null)
      .order('position'),
  ])

  const team: ProposalTeamMember[] = (assignedTeam ?? []).flatMap((assignment) => {
    const member = assignment.team_members as unknown as {
      id: string
      name: string
      job_title: string | null
      avatar_url: string | null
      contact_email: string | null
      email_alias: string | null
    } | null
    if (!member) return []
    return [
      {
        id: member.id,
        name: member.name,
        job_title: member.job_title,
        avatar_url: member.avatar_url,
        contactEmail: member.contact_email?.trim() || member.email_alias?.trim() || null,
      },
    ]
  })

  return { items, specs, settings, payments, depositInvoice, contact, team }
}
