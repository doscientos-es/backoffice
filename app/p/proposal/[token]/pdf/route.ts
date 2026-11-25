import { after, type NextRequest, NextResponse } from 'next/server'

import { formatAddress } from '@/lib/address'
import { getCurrentUser, hasMfaAccess } from '@/lib/auth'
import { externalAppUrl } from '@/lib/email/app-url'
import { publicEnv } from '@/lib/env'
import {
  type BillingCycle,
  computeLineSubtotal,
  computeProposalTotals,
  type DiscountType,
} from '@/lib/finance'
import { isPortalUnlocked } from '@/lib/portal/access'
import { resolvePortalLanguage } from '@/lib/portal/language'
import { recordProposalEngagement } from '@/lib/proposals/engagement'
import {
  HandwrittenSignatureSchema,
  ProviderSignatureSchema,
} from '@/lib/proposals/handwritten-signature'
import { parseKeyPoints } from '@/lib/proposals/key-points'
import {
  maintenancePlanAsLineItem,
  parseMaintenanceOffer,
  selectedMaintenancePlan,
} from '@/lib/proposals/maintenance'
import { effectiveProposalTerms } from '@/lib/proposals/proposal-acceptance'
import {
  type ProposalPdfItem,
  proposalPdfFilename,
  renderProposalPdf,
} from '@/lib/proposals/proposal-pdf-document'
import { ensureCalendarYearProration, recurringPaymentTerms } from '@/lib/proposals/recurring'
import { type PaymentSchedule, parseScopeModules } from '@/lib/proposals/scope'
import { parseTimeline } from '@/lib/proposals/timeline'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArchivedParty = {
  name?: string | null
  nif?: string | null
  iban?: string | null
  street?: string | null
  zip?: string | null
  city?: string | null
  province?: string | null
  country?: string | null
}

type RevisionSnapshot = {
  proposal: Record<string, unknown>
  items: Array<Record<string, unknown>>
  recipient?: ArchivedParty | null
  provider?: ArchivedParty | null
}

/** Downloads the formal proposal PDF with the same access policy as its portal. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params
  const admin = createAdminClient()
  const auth = await getCurrentUser()
  const isTeam = auth.ok
  const acceptanceId = req.nextUrl.searchParams.get('acceptance')
  const revisionId = req.nextUrl.searchParams.get('revision')
  const historical = acceptanceId !== null || revisionId !== null

  // Historical documents are internal, even when the proposal URL is public.
  if (historical) {
    if (
      (acceptanceId !== null && revisionId !== null) ||
      !auth.ok ||
      !['owner', 'admin'].includes(auth.user.role) ||
      !(await hasMfaAccess(auth.user.id))
    ) {
      return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    }
  }

  const { data: proposal } = await admin
    .from('proposals')
    .select('*, clients(name, lead_id, leads(language)), leads(name, company, language)')
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!proposal || (proposal.status === 'draft' && !isTeam)) {
    return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  }
  let revision: RevisionSnapshot | null = null
  if (historical) {
    const supabase = await createServerClient()
    const { data: accessible } = await supabase
      .from('proposals')
      .select('id')
      .eq('id', proposal.id as string)
      .is('deleted_at', null)
      .maybeSingle()
    if (!accessible) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    if (revisionId !== null) {
      const { data } = await supabase
        .from('proposal_revisions')
        .select('snapshot')
        .eq('id', revisionId)
        .eq('proposal_id', proposal.id as string)
        .maybeSingle()
      revision = (data?.snapshot as RevisionSnapshot | null) ?? null
      if (!revision?.proposal || !Array.isArray(revision.items)) {
        return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
      }
    }
  }
  const clientLanguage = (
    proposal.clients as { leads?: { language?: string | null } | null } | null
  )?.leads?.language
  const leadLanguage = (proposal.leads as { language?: string | null } | null)?.language
  const language = resolvePortalLanguage(
    leadLanguage ?? clientLanguage,
    req.nextUrl.searchParams.get('lang'),
  )
  if (!isTeam) {
    if ((proposal.is_client_visible as boolean | null) === false) {
      return NextResponse.json({ error: 'Propuesta no disponible' }, { status: 404 })
    }
    const unlocked = await isPortalUnlocked(
      token,
      (proposal.portal_password_hash as string | null) ?? null,
    )
    if (!unlocked) {
      const target = new URL(`/p/proposal/${token}`, req.url)
      if (req.nextUrl.searchParams.has('lang')) target.searchParams.set('lang', language)
      return NextResponse.redirect(target)
    }

    // Downloading the PDF to read or forward it is a sign of interest.
    if (['sent', 'viewed'].includes(proposal.status as string)) {
      after(() =>
        recordProposalEngagement(
          {
            id: proposal.id as string,
            number: (proposal.number as string | null) ?? null,
            title: (proposal.title as string | null) ?? null,
            lead_id: (proposal.lead_id as string | null) ?? null,
            client_id: (proposal.client_id as string | null) ?? null,
            created_by: (proposal.created_by as string | null) ?? null,
          },
          'pdf_download',
        ),
      )
    }
  }

  const { data: items, error: itemsError } = await admin
    .from('proposal_items')
    .select(
      'id, description, quantity, unit_price, vat_rate, subtotal, billing_cycle, discount_percent, discount_reason',
    )
    .eq('proposal_id', proposal.id as string)
    .order('position')
  if (itemsError) return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 })
  const { data: settings } = await admin
    .from('settings')
    .select('company_name, company_nif, iban')
    .eq('id', 1)
    .maybeSingle()
  // A reopened proposal may retain evidence from an earlier acceptance. Only
  // the record created by the current response describes the current document.
  const acceptanceQuery = () =>
    admin
      .from('proposal_acceptances')
      .select(
        'signer_name, signer_role, accepted_at, document_hash, consent_text, document_snapshot',
      )
      .eq('proposal_id', proposal.id as string)
  const responseSource = revision?.proposal ?? proposal
  const { data: acceptance, error: acceptanceError } =
    acceptanceId !== null
      ? await acceptanceQuery().eq('id', acceptanceId).maybeSingle()
      : responseSource.status === 'accepted' && responseSource.responded_at
        ? await acceptanceQuery()
            .eq('accepted_at', responseSource.responded_at as string)
            .limit(1)
            .maybeSingle()
        : { data: null, error: null }
  if (acceptanceId !== null && (acceptanceError || !acceptance)) {
    return NextResponse.json({ error: 'Aceptación no encontrada' }, { status: 404 })
  }
  if (acceptanceError) {
    return NextResponse.json({ error: 'No se pudo cargar la aceptación' }, { status: 500 })
  }

  const signedSnapshot = acceptance?.document_snapshot as {
    version?: string
    handwritten_signature?: unknown
    provider_signature?: unknown
    proposal?: Record<string, unknown>
    fiscal_data?: { name?: string } | null
    parties?: {
      provider?: { name?: string | null; nif?: string | null; address?: string | null }
      client?: { name?: string | null; nif?: string | null; address?: string | null }
    } | null
    contract?: {
      client_capacity?: 'business' | 'consumer'
      consumer_early_start_requested?: boolean
    } | null
  } | null
  const signedProposal = signedSnapshot?.proposal
  if (acceptance && (!signedProposal || !Array.isArray(signedProposal.items))) {
    return NextResponse.json({ error: 'Documento histórico no disponible' }, { status: 404 })
  }
  const documentSource =
    signedProposal ?? revision?.proposal ?? (proposal as Record<string, unknown>)
  const preserved = Boolean(signedProposal || revision)
  const legalTerms =
    signedProposal && !('legal_terms' in signedProposal)
      ? ((documentSource.terms as string | null) ?? '')
      : effectiveProposalTerms(
          (documentSource.terms as string | null) ?? null,
          (documentSource.legal_terms as string | null) ?? null,
        )
  const rawItems = Array.isArray(signedProposal?.items)
    ? signedProposal.items
    : (revision?.items ?? items ?? [])
  const signedItems = preserved
    ? rawItems
    : ensureCalendarYearProration(
        rawItems as Array<{
          id?: string
          description: string
          quantity: number
          unit_price: number
          vat_rate: number
          billing_cycle: BillingCycle | null
        }>,
        (proposal.created_at as string | null) ?? null,
      )
  const client = (proposal as unknown as { clients: { name: string } | null }).clients
  const lead = (
    proposal as unknown as { leads: { name: string | null; company: string | null } | null }
  ).leads
  const maintenanceOffer = parseMaintenanceOffer(documentSource.maintenance_options)
  // Preserve previously signed maintenance charges, never add options to an unsigned quote.
  const maintenancePlan = selectedMaintenancePlan(
    maintenanceOffer,
    (signedProposal?.maintenance_selected_plan_id as string | null) ?? null,
  )
  const pdfItems: ProposalPdfItem[] = (signedItems as Array<Record<string, unknown>>).map(
    (item): ProposalPdfItem => ({
      id: String(item.id),
      description: typeof item.description === 'string' ? item.description : '',
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unit_price ?? 0),
      vatRate: Number(item.vat_rate ?? 0),
      subtotal: computeLineSubtotal({
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
      }),
      billingCycle: (item.billing_cycle as string | null) ?? null,
      discountPercent: Number(item.discount_percent ?? 0),
      discountReason: (item.discount_reason as string | null) ?? null,
    }),
  )
  if (maintenancePlan) {
    const item = maintenancePlanAsLineItem(maintenancePlan, maintenanceOffer.billing_cycle)
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
  const calculatedTotals = computeProposalTotals(
    pdfItems.map((item) => ({
      quantity: item.quantity,
      unit_price: item.unitPrice,
      vat_rate: item.vatRate,
      billing_cycle: (item.billingCycle as BillingCycle | null) ?? 'none',
      discount_percent: item.discountPercent ?? 0,
    })),
    {
      type: ((documentSource.discount_type as string | null) ?? 'none') as DiscountType,
      value: Number(documentSource.discount_value ?? 0),
    },
  )
  const automaticPaymentTerms = recurringPaymentTerms(
    pdfItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      vat_rate: item.vatRate,
      billing_cycle: (item.billingCycle as BillingCycle | null) ?? null,
    })),
    (proposal.created_at as string | null) ?? null,
  )
  const pdfSubtotal = preserved
    ? Number(documentSource.subtotal ?? 0)
    : calculatedTotals.oneTime.subtotal
  const pdfTaxAmount = preserved
    ? Number(documentSource.tax_amount ?? 0)
    : calculatedTotals.oneTime.taxAmount
  const pdfTotal = preserved ? Number(documentSource.total ?? 0) : calculatedTotals.oneTime.total
  const title = typeof documentSource.title === 'string' ? documentSource.title : ''
  const recipientName =
    signedSnapshot?.parties?.client?.name ??
    signedSnapshot?.fiscal_data?.name ??
    (signedProposal
      ? 'Cliente'
      : revision
        ? (revision.recipient?.name ?? 'Cliente')
        : (client?.name ?? lead?.company ?? lead?.name ?? 'Cliente'))
  const pdf = await renderProposalPdf({
    language,
    number: (documentSource.number as string | null) ?? null,
    title,
    recipientName,
    recipientNif:
      signedSnapshot?.parties?.client?.nif ??
      (signedSnapshot?.fiscal_data as { nif?: string } | null)?.nif ??
      (signedProposal ? null : revision?.recipient?.nif) ??
      null,
    recipientAddress:
      signedSnapshot?.parties?.client?.address ??
      (signedProposal || !revision?.recipient ? null : formatAddress(revision.recipient) || null),
    validUntil: (documentSource.valid_until as string | null) ?? null,
    context: (documentSource.context_markdown as string | null) ?? null,
    problems: parseKeyPoints(documentSource.problems),
    solutions: parseKeyPoints(documentSource.solutions),
    scopeModules: parseScopeModules(documentSource.scope_modules),
    timeline: parseTimeline(documentSource.timeline),
    historical,
    developmentApproach: (documentSource.development_approach as string | null) ?? null,
    deliverables: (documentSource.deliverables as string | null) ?? null,
    acceptanceCriteria: (documentSource.acceptance_criteria as string | null) ?? null,
    paymentSchedule: (documentSource.payment_schedule as PaymentSchedule | null) ?? 'half_half',
    paymentTerms:
      (documentSource.payment_terms as string | null) ?? (preserved ? null : automaticPaymentTerms),
    changeManagementTerms: (documentSource.change_management_terms as string | null) ?? null,
    legalTerms,
    notes: (documentSource.notes as string | null) ?? null,
    subtotal: pdfSubtotal,
    taxAmount: pdfTaxAmount,
    total: pdfTotal,
    discounts: {
      ...calculatedTotals.discounts,
      globalReason: ((documentSource.discount_reason as string | null) ?? '').trim() || null,
    },
    items: pdfItems,
    maintenanceOffer,
    portalUrl: `${externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)}/p/proposal/${token}?lang=${language}`,
    companyName:
      signedSnapshot?.parties?.provider?.name ??
      (signedProposal
        ? null
        : revision
          ? (revision.provider?.name ?? null)
          : ((settings?.company_name as string | null) ?? null)),
    companyNif:
      signedSnapshot?.parties?.provider?.nif ??
      (signedProposal
        ? null
        : revision
          ? (revision.provider?.nif ?? null)
          : ((settings?.company_nif as string | null) ?? null)),
    companyAddress:
      signedSnapshot?.parties?.provider?.address ??
      (signedProposal || !revision?.provider ? null : formatAddress(revision.provider) || null),
    // Older acceptance evidence did not capture the bank account. Never add
    // today's details to a reconstruction of a historical signed document.
    iban: signedProposal
      ? null
      : revision
        ? (revision.provider?.iban ?? null)
        : ((settings?.iban as string | null) ?? null),
    providerSignature:
      ProviderSignatureSchema.safeParse(
        signedProposal ? signedSnapshot?.provider_signature : documentSource.provider_signature,
      ).data ?? null,
    acceptance:
      (responseSource.status === 'accepted' || acceptanceId !== null) && acceptance
        ? {
            signerName: acceptance.signer_name as string,
            signerRole: (acceptance.signer_role as string | null) ?? null,
            acceptedAt: acceptance.accepted_at as string,
            documentHash: acceptance.document_hash as string,
            consentText: acceptance.consent_text as string,
            clientCapacity: signedSnapshot?.contract?.client_capacity ?? null,
            consumerEarlyStartRequested:
              signedSnapshot?.contract?.consumer_early_start_requested ?? false,
            handwrittenSignature:
              HandwrittenSignatureSchema.safeParse(signedSnapshot?.handwritten_signature).data ??
              null,
          }
        : null,
    acceptedWithoutSignature: responseSource.status === 'accepted' && !acceptance,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${proposalPdfFilename(title, recipientName)}"`,
      'Content-Type': 'application/pdf',
    },
  })
}
