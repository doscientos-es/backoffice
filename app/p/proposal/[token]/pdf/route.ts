import { type NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { externalAppUrl } from '@/lib/email/app-url'
import { publicEnv } from '@/lib/env'
import { isPortalUnlocked } from '@/lib/portal/access'
import { parseKeyPoints } from '@/lib/proposals/key-points'
import {
  maintenancePlanAsLineItem,
  parseMaintenanceOffer,
  selectedMaintenancePlan,
} from '@/lib/proposals/maintenance'
import {
  DEFAULT_PROPOSAL_LEGAL_TERMS,
  effectiveProposalTerms,
} from '@/lib/proposals/proposal-acceptance'
import {
  type ProposalPdfItem,
  proposalPdfFilename,
  renderProposalPdf,
} from '@/lib/proposals/proposal-pdf-document'
import { type PaymentSchedule, parseScopeModules } from '@/lib/proposals/scope'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Downloads the formal proposal PDF with the same access policy as its portal. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params
  const admin = createAdminClient()
  const auth = await getCurrentUser()
  const isTeam = auth.ok

  const { data: proposal } = await admin
    .from('proposals')
    .select('*, clients(name), leads(name, company)')
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!proposal || (proposal.status === 'draft' && !isTeam)) {
    return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  }
  if (!isTeam) {
    if ((proposal.is_client_visible as boolean | null) === false) {
      return NextResponse.json({ error: 'Propuesta no disponible' }, { status: 404 })
    }
    const unlocked = await isPortalUnlocked(
      token,
      (proposal.portal_password_hash as string | null) ?? null,
    )
    if (!unlocked) return NextResponse.redirect(new URL(`/p/proposal/${token}`, req.url))
  }

  const { data: items, error: itemsError } = await admin
    .from('proposal_items')
    .select('id, description, quantity, unit_price, vat_rate, subtotal, billing_cycle')
    .eq('proposal_id', proposal.id as string)
    .order('position')
  if (itemsError) return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 })
  const { data: settings } = await admin
    .from('settings')
    .select('company_name, company_nif, iban')
    .eq('id', 1)
    .maybeSingle()
  const { data: acceptance } = await admin
    .from('proposal_acceptances')
    .select('signer_name, signer_role, accepted_at, document_hash, document_snapshot')
    .eq('proposal_id', proposal.id as string)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const signedSnapshot = acceptance?.document_snapshot as
    | { version?: string; proposal?: Record<string, unknown>; fiscal_data?: { name?: string } | null }
    | null
  const signedProposal = signedSnapshot?.proposal
  const documentSource = signedProposal ?? (proposal as Record<string, unknown>)
  const legalTerms =
    signedProposal && !('legal_terms' in signedProposal)
      ? ((documentSource.terms as string | null) ?? DEFAULT_PROPOSAL_LEGAL_TERMS)
      : effectiveProposalTerms(
          (documentSource.terms as string | null) ?? null,
          (documentSource.legal_terms as string | null) ?? null,
        )
  const signedItems = Array.isArray(signedProposal?.items) ? signedProposal.items : items ?? []
  const client = (proposal as unknown as { clients: { name: string } | null }).clients
  const lead = (
    proposal as unknown as { leads: { name: string | null; company: string | null } | null }
  ).leads
  const maintenanceOffer = parseMaintenanceOffer(documentSource.maintenance_options)
  const maintenanceSelectedPlanId =
    (documentSource.maintenance_selected_plan_id as string | null) ?? null
  const maintenancePlan = selectedMaintenancePlan(maintenanceOffer, maintenanceSelectedPlanId)
  const pdfItems: ProposalPdfItem[] = (signedItems as Array<Record<string, unknown>>).map(
    (item): ProposalPdfItem => ({
      id: String(item.id),
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unit_price ?? 0),
      vatRate: Number(item.vat_rate ?? 0),
      subtotal: Number(item.subtotal ?? 0),
      billingCycle: (item.billing_cycle as string | null) ?? null,
    }),
  )
  if (maintenancePlan) {
    const item = maintenancePlanAsLineItem(maintenancePlan)
    pdfItems.push({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      vatRate: item.vat_rate,
      subtotal: item.subtotal,
      billingCycle: item.billing_cycle,
    })
  }
  const pdf = await renderProposalPdf({
    number: (documentSource.number as string | null) ?? null,
    title: documentSource.title as string,
    recipientName:
      signedSnapshot?.fiscal_data?.name ?? client?.name ?? lead?.company ?? lead?.name ?? 'Cliente',
    validUntil: (documentSource.valid_until as string | null) ?? null,
    context: (documentSource.context_markdown as string | null) ?? null,
    problems: parseKeyPoints(documentSource.problems),
    solutions: parseKeyPoints(documentSource.solutions),
    scopeModules: parseScopeModules(documentSource.scope_modules),
    deliverables: (documentSource.deliverables as string | null) ?? null,
    acceptanceCriteria: (documentSource.acceptance_criteria as string | null) ?? null,
    paymentSchedule: (documentSource.payment_schedule as PaymentSchedule | null) ?? 'half_half',
    paymentTerms: (documentSource.payment_terms as string | null) ?? null,
    changeManagementTerms: (documentSource.change_management_terms as string | null) ?? null,
    legalTerms,
    notes: (documentSource.notes as string | null) ?? null,
    subtotal: Number(documentSource.subtotal ?? 0),
    taxAmount: Number(documentSource.tax_amount ?? 0),
    total: Number(documentSource.total ?? 0),
    items: pdfItems,
    maintenanceOffer,
    maintenanceSelectedPlanId,
    portalUrl: `${externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)}/p/proposal/${token}`,
    companyName: (settings?.company_name as string | null) ?? null,
    companyNif: (settings?.company_nif as string | null) ?? null,
    iban: (settings?.iban as string | null) ?? null,
    acceptance:
      proposal.status === 'accepted' && acceptance
        ? {
            signerName: acceptance.signer_name as string,
            signerRole: (acceptance.signer_role as string | null) ?? null,
            acceptedAt: acceptance.accepted_at as string,
            documentHash: acceptance.document_hash as string,
          }
        : null,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${proposalPdfFilename((proposal.number as string | null) ?? null, proposal.id as string)}"`,
      'Content-Type': 'application/pdf',
    },
  })
}
