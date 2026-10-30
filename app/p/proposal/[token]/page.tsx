import { CircleCheck as CheckCircle2, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PortalPasswordGate } from '@/components/portal/password-gate'
import {
  type ProposalMessage,
  ProposalMessageThread,
} from '@/components/proposals/proposal-message-thread'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Markdown } from '@/components/ui/markdown'
import { formatAddress } from '@/lib/address'
import { getCurrentUser } from '@/lib/auth'
import { computeLineSubtotal, computeProposalTotals, type DiscountType } from '@/lib/finance'
import { scopedLogger } from '@/lib/logger'
import { isPortalUnlocked } from '@/lib/portal/access'
import { formatPortalEUR, resolvePortalLanguage } from '@/lib/portal/language'
import { parseKeyPoints } from '@/lib/proposals/key-points'
import {
  maintenancePlanAsLineItem,
  parseMaintenanceOffer,
  selectedMaintenancePlan,
} from '@/lib/proposals/maintenance'
import { effectiveProposalTerms } from '@/lib/proposals/proposal-acceptance'
import { ensureCalendarYearProration, recurringPaymentTerms } from '@/lib/proposals/recurring'
import {
  effectivePaymentPlan,
  type PaymentSchedule,
  parseScopeModules,
  paymentInitialPercentage,
} from '@/lib/proposals/scope'
import type { ProposalStatus } from '@/lib/status'
import { createAdminClient } from '@/lib/supabase/admin'

import { ContactCard } from './_components/contact-card'
import { DecisionSummary } from './_components/decision-summary'
import { DocumentHeader, RecipientBlock } from './_components/document-header'
import { LineItems } from './_components/line-items'
import { NextSteps } from './_components/next-steps'
import { PresentationCard } from './_components/presentation-card'
import { PricingSummary } from './_components/pricing-summary'
import { MobileCtaBar, type NavItem, SectionNav } from './_components/respond-controls'
import { ResponseArea } from './_components/response-area'
import { ScopeSection } from './_components/scope-section'
import { NotesSection, SpecsSection, TermsSection } from './_components/terms-section'
import { getPortalCopy, getStatusLabel, makeTr } from './_lib/i18n'
import { loadProposalData } from './_lib/load-proposal-data'
import { daysUntilExpiry, estimatedTotalWeeks } from './_lib/summary'
import { trackProposalView } from './_lib/track-view'
import type { ProposalItem, ProposalSpec } from './_lib/types'
import { sendProposalQuestion, unlockProposalPortal } from './actions'
import { PortalKeyPointsList, PortalNarrativeBlock } from './narrative'
import { ProposalActions } from './proposal-actions'
import { ProposalMaintenanceOptions } from './proposal-maintenance-options'

const log = scopedLogger('portal.proposal')

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Propuesta · doscientos',
  robots: { index: false, follow: false },
}

export default async function PortalProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ success?: string; error?: string; lang?: string }>
}) {
  const { token } = await params
  const { success, error, lang } = await searchParams
  const admin = createAdminClient()

  // Auth and proposal lookup are independent, so run them together. Auth decides
  // whether team members can preview drafts.
  const [auth, { data: proposal, error: proposalError }] = await Promise.all([
    getCurrentUser(),
    admin
      .from('proposals')
      .select(
        '*, clients(name, nif, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country, email, phone, contact_person, logo_url, lead_id, leads(language)), leads(name, email, phone, company, language)',
      )
      .eq('portal_token', token)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  const isTeam = auth.ok

  // Drafts are only accessible to authenticated team members.
  if (proposalError) {
    log.error({ err: proposalError }, 'portal_proposal_lookup_failed')
    notFound()
  }
  if (!proposal) {
    log.error({ token }, 'portal_proposal_not_found — query returned null')
    notFound()
  }
  if (proposal.status === 'draft' && !isTeam) {
    log.warn({ proposalId: proposal.id, status: proposal.status }, 'portal_draft_blocked_non_team')
    notFound()
  }

  const isDraft = proposal.status === 'draft'
  const portalLanguage = resolvePortalLanguage(
    (proposal.leads as { language?: string | null } | null)?.language ??
      (proposal.clients as { leads?: { language?: string | null } | null } | null)?.leads?.language,
    lang,
  )
  const copy = getPortalCopy(portalLanguage)
  const tr = makeTr(portalLanguage)

  // Client-facing access gate: hidden proposals 404 and password-protected
  // ones show the unlock form until the visitor presents a valid cookie. Team
  // members always bypass so they can preview the link.
  if (!isTeam) {
    if ((proposal.is_client_visible as boolean | null) === false) {
      log.warn({ proposalId: proposal.id }, 'portal_proposal_hidden_from_client')
      notFound()
    }
    const unlocked = await isPortalUnlocked(
      token,
      (proposal.portal_password_hash as string | null) ?? null,
    )
    if (!unlocked) {
      return (
        <PortalPasswordGate token={token} action={unlockProposalPortal} language={portalLanguage} />
      )
    }
  }

  const {
    items,
    specs,
    messages,
    settings,
    payments: proposalPayments,
    depositInvoice,
    contact,
  } = await loadProposalData(proposal)

  if (!isDraft) {
    await trackProposalView({
      proposal,
      isTeam,
      teamMemberId: auth.ok ? auth.user.id : null,
    })
  }

  const client = (
    proposal as unknown as {
      clients: {
        name: string
        nif: string | null
        billing_address_street: string | null
        billing_address_zip: string | null
        billing_address_city: string | null
        billing_address_province: string | null
        billing_address_country: string | null
        email: string | null
        phone: string | null
        contact_person: string | null
        logo_url: string | null
      } | null
    }
  ).clients
  const lead = (
    proposal as unknown as {
      leads: {
        name: string
        email: string | null
        phone: string | null
        company: string | null
      } | null
    }
  ).leads
  const storedStatus = proposal.status as ProposalStatus
  const responded = storedStatus === 'accepted' || storedStatus === 'rejected'
  const validUntil = (proposal.valid_until as string | null) ?? null
  const daysLeft = daysUntilExpiry(validUntil)
  // The accept actions refuse a proposal past its date even if the stored status
  // has not been flipped to `expired` yet, so the page must not offer it either.
  const expired =
    !responded && storedStatus !== 'draft' && (storedStatus === 'expired' || (daysLeft ?? 0) < 0)
  const status: ProposalStatus = expired ? 'expired' : storedStatus
  const statusLabel = getStatusLabel(portalLanguage, status)

  // The lead branch always asks for fiscal data (no `clients` row exists yet).
  // The client branch only asks when the legal minimum (name + NIF + billing
  // address) is missing — typically a placeholder client created by the
  // back-office for prospects that never went through onboarding.
  const clientBillingAddress = client
    ? formatAddress({
        street: client.billing_address_street,
        zip: client.billing_address_zip,
        city: client.billing_address_city,
        province: client.billing_address_province,
        country: client.billing_address_country,
      })
    : ''
  const needsFiscal = !client?.nif?.trim() || !clientBillingAddress || !client.name?.trim()
  const fiscalPrefill = client
    ? {
        name: client.name ?? '',
        nif: client.nif ?? '',
        billing_address: clientBillingAddress,
        contact_person: client.contact_person ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
      }
    : {
        name: lead?.company ?? lead?.name ?? '',
        nif: '',
        billing_address: '',
        contact_person: lead?.name ?? '',
        email: lead?.email ?? '',
        phone: lead?.phone ?? '',
      }
  const recipientName = client?.name ?? lead?.company ?? lead?.name ?? '—'
  const proposalNumber = (proposal.number as string | null) ?? 'Borrador'
  const rawItems = (items ?? []) as unknown as ProposalItem[]
  const baseItems =
    proposal.status === 'accepted'
      ? rawItems
      : (ensureCalendarYearProration(
          rawItems,
          (proposal.created_at as string | null) ?? null,
        ) as ProposalItem[])
  const displayBaseItems = baseItems.map((item) => ({
    ...item,
    subtotal: computeLineSubtotal(item),
  }))
  const safeSpecs = (specs ?? []) as unknown as ProposalSpec[]
  const proposalMessages = (messages ?? []) as unknown as ProposalMessage[]
  const contextMarkdown = ((proposal.context_markdown as string | null) ?? '').trim()
  const problems = parseKeyPoints(proposal.problems)
  const solutions = parseKeyPoints(proposal.solutions)
  const terms = (proposal.terms as string | null) ?? null
  const legalTerms = (proposal.legal_terms as string | null) ?? null
  const contractualAnnex = effectiveProposalTerms(terms, legalTerms)
  const scopeModules = parseScopeModules(proposal.scope_modules)
  const deliverables = ((proposal.deliverables as string | null) ?? '').trim()
  const acceptanceCriteria = ((proposal.acceptance_criteria as string | null) ?? '').trim()
  const paymentSchedule = (proposal.payment_schedule as PaymentSchedule | null) ?? 'half_half'
  const paymentTerms =
    (proposal.payment_terms as string | null) ??
    recurringPaymentTerms(baseItems, (proposal.created_at as string | null) ?? null)
  const changeManagementTerms = (proposal.change_management_terms as string | null) ?? null
  const maintenanceOffer = parseMaintenanceOffer(proposal.maintenance_options)
  const maintenancePlan = selectedMaintenancePlan(
    maintenanceOffer,
    (proposal.maintenance_selected_plan_id as string | null) ?? null,
  )
  const safeItems: ProposalItem[] = maintenancePlan
    ? [
        ...displayBaseItems,
        maintenancePlanAsLineItem(maintenancePlan, maintenanceOffer.billing_cycle),
      ]
    : displayBaseItems

  // Recompute totals on the fly so we can show separate buckets for one-time
  // and recurring lines. The stored `proposals.total` reflects the one-time
  // portion only — kept in sync by the proposal actions.
  const totals = computeProposalTotals(
    safeItems.map((it) => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
      billing_cycle: it.billing_cycle ?? 'none',
      discount_percent: it.discount_percent ?? 0,
    })),
    {
      type: ((proposal.discount_type as string | null) ?? 'none') as DiscountType,
      value: Number(proposal.discount_value ?? 0),
    },
  )
  const globalDiscountReason = ((proposal.discount_reason as string | null) ?? '').trim() || null
  const hasRecurring =
    totals.monthly.total > 0 || totals.quarterly.total > 0 || totals.yearly.total > 0

  const confirmedPayments = proposalPayments ?? []
  const signalPaid = confirmedPayments.length > 0
  const initialPaymentPercentage = paymentInitialPercentage(paymentSchedule)
  const depositAmount =
    initialPaymentPercentage === null
      ? null
      : depositInvoice
        ? Number(depositInvoice.total)
        : Math.round(Number(proposal.total) * initialPaymentPercentage) / 100

  const canRespond = !isDraft && !responded && !expired
  const paymentPlan = effectivePaymentPlan(proposal.payment_plan, proposal.payment_schedule)
  const hasScope = scopeModules.length > 0 || Boolean(deliverables) || Boolean(acceptanceCriteria)
  const hasNarrative = Boolean(contextMarkdown) || problems.length > 0 || solutions.length > 0
  const navItems: NavItem[] = [
    hasNarrative && { id: 'contexto', label: tr('Contexto', 'Context', 'Context') },
    hasScope && { id: 'alcance', label: tr('Alcance', 'Abast', 'Scope') },
    { id: 'inversion', label: tr('Inversión', 'Inversió', 'Investment') },
    Boolean(paymentTerms || changeManagementTerms) && {
      id: 'condiciones',
      label: tr('Condiciones', 'Condicions', 'Terms'),
    },
    canRespond && {
      id: 'siguientes-pasos',
      label: tr('Al aceptar', 'En acceptar', 'On acceptance'),
    },
  ].filter((item): item is NavItem => item !== false)

  // Accept/decline panel: rendered in the sidebar on desktop and below the
  // document on mobile. Each rendering is marked so the "accept" shortcuts can
  // scroll to whichever one is visible.
  const actions = (
    <div data-proposal-response className="scroll-mt-24">
      <ProposalActions
        token={token}
        language={portalLanguage}
        needsFiscal={needsFiscal}
        fiscalPrefill={fiscalPrefill}
        signerPrefill={client?.contact_person ?? lead?.name ?? ''}
        legalTerms={contractualAnnex}
      />
    </div>
  )

  return (
    <div className={`flex flex-col gap-4 pt-4 lg:pt-6 ${canRespond ? 'pb-24 lg:pb-0' : ''}`}>
      {isDraft && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="tracking-wider uppercase">{copy.draft}</span>
          <span className="opacity-50">·</span>
          <span className="font-normal opacity-75">{copy.teamOnly}</span>
        </div>
      )}
      {success && (
        <Alert className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-300">
            {copy.confirmed}
          </AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            {tr(
              'Hemos recibido el pago de la señal. El proyecto se pondrá en marcha en breve.',
              'Hem rebut el pagament de la bestreta. El projecte es posarà en marxa aviat.',
              'We received the deposit. The project will get underway shortly.',
            )}
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>{copy.paymentError}</AlertTitle>
          <AlertDescription>
            {tr(
              'No se ha podido procesar el pago. Por favor, inténtalo de nuevo o contacta con nosotros.',
              'No s’ha pogut processar el pagament. Torna-ho a provar o contacta amb nosaltres.',
              'We could not process the payment. Please try again or contact us.',
            )}
          </AlertDescription>
        </Alert>
      )}
      <SectionNav items={navItems} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <article className="overflow-hidden border-y border-zinc-200 dark:border-zinc-800">
          <DocumentHeader
            token={token}
            language={portalLanguage}
            copy={copy}
            proposalNumber={proposalNumber}
            title={proposal.title as string}
            validUntil={validUntil}
            daysLeft={daysLeft}
            status={status}
            statusLabel={statusLabel}
          />
          <RecipientBlock
            label={copy.recipient}
            name={recipientName}
            logoUrl={client?.logo_url ?? null}
          />
          {!responded && !expired ? (
            <DecisionSummary
              language={portalLanguage}
              tr={tr}
              totals={totals}
              depositAmount={depositAmount}
              initialPaymentPercentage={initialPaymentPercentage}
              totalWeeks={estimatedTotalWeeks(scopeModules)}
              canRespond={canRespond}
            />
          ) : null}

          {/* Narrative: Context → Problems → Solutions (always before price) */}
          {hasNarrative ? (
            <div
              id="contexto"
              className="flex scroll-mt-16 flex-col divide-y divide-zinc-100 border-b border-zinc-100 dark:divide-zinc-800/60 dark:border-zinc-800/60"
            >
              {contextMarkdown ? (
                <PortalNarrativeBlock label={tr('Contexto', 'Context', 'Context')}>
                  <Markdown source={contextMarkdown} />
                </PortalNarrativeBlock>
              ) : null}
              {problems.length > 0 ? (
                <PortalNarrativeBlock
                  label={tr('Problemas detectados', 'Reptes detectats', 'Challenges identified')}
                >
                  <PortalKeyPointsList items={problems} variant="problems" />
                </PortalNarrativeBlock>
              ) : null}
              {solutions.length > 0 ? (
                <PortalNarrativeBlock
                  label={tr('Cómo lo abordamos', 'Com ho abordem', 'Our approach')}
                >
                  <PortalKeyPointsList items={solutions} variant="solutions" />
                </PortalNarrativeBlock>
              ) : null}
            </div>
          ) : null}

          <div id="alcance" className="scroll-mt-16">
            <ScopeSection
              modules={scopeModules}
              deliverables={deliverables}
              acceptanceCriteria={acceptanceCriteria}
              tr={tr}
            />
          </div>
          <div id="inversion" className="scroll-mt-16">
            <LineItems
              items={safeItems}
              hasRecurring={hasRecurring}
              language={portalLanguage}
              tr={tr}
            />
            <PricingSummary
              totals={totals}
              paymentPlan={paymentPlan}
              globalDiscountReason={globalDiscountReason}
              language={portalLanguage}
              tr={tr}
            />
          </div>
          <div id="condiciones" className="scroll-mt-16">
            <TermsSection
              paymentTerms={paymentTerms}
              paymentSchedule={paymentSchedule}
              changeManagementTerms={changeManagementTerms}
              tr={tr}
            />
          </div>
          <NotesSection notes={(proposal.notes as string | null) ?? null} tr={tr} />
          <SpecsSection specs={safeSpecs} language={portalLanguage} tr={tr} />
          {canRespond ? (
            <NextSteps
              language={portalLanguage}
              tr={tr}
              needsFiscal={needsFiscal}
              depositAmount={depositAmount}
            />
          ) : null}
          {contact && !responded && !expired ? (
            <ContactCard contact={contact} proposalNumber={proposalNumber} tr={tr} />
          ) : null}
        </article>
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          {canRespond ? <div className="max-lg:hidden">{actions}</div> : null}
          <ProposalMessageThread
            messages={proposalMessages}
            submit={sendProposalQuestion.bind(null, token)}
            disabled={isDraft || responded || expired || isTeam}
            sticky={false}
            language={portalLanguage}
          />
          <PresentationCard token={token} language={portalLanguage} className="max-lg:hidden" />
        </aside>

        {maintenanceOffer.enabled ? (
          <ProposalMaintenanceOptions
            token={token}
            offer={maintenanceOffer}
            selectedPlanId={(proposal.maintenance_selected_plan_id as string | null) ?? null}
            disabled={isDraft || responded || expired || isTeam}
            language={portalLanguage}
          />
        ) : null}
        <PresentationCard token={token} language={portalLanguage} className="lg:hidden" />
      </div>

      {/* Response area — hidden for draft previews */}
      {!isDraft && (responded || expired) ? (
        <ResponseArea
          token={token}
          language={portalLanguage}
          status={status}
          isTeam={isTeam}
          expired={expired}
          contactEmail={contact?.email ?? null}
          respondedAt={(proposal.responded_at as string | null) ?? null}
          proposalId={proposal.id as string}
          proposalNumber={proposalNumber}
          signalPaid={signalPaid}
          firstPayment={confirmedPayments[0]}
          depositAmount={depositAmount}
          initialPaymentPercentage={initialPaymentPercentage}
          companyName={(settings?.company_name as string | null) ?? null}
          iban={(settings?.iban as string | null) ?? null}
        />
      ) : canRespond ? (
        <div className="lg:hidden">{actions}</div>
      ) : null}
      {canRespond ? (
        <MobileCtaBar
          totalLabel={tr('Inversión', 'Inversió', 'Investment')}
          total={formatPortalEUR(totals.oneTime.total, portalLanguage)}
          cta={tr('Revisar y aceptar', 'Revisar i acceptar', 'Review and accept')}
        />
      ) : null}
    </div>
  )
}
