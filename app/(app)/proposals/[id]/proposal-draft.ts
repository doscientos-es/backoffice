import { EMPTY_LINE_ITEM, type LineItem } from '@/lib/finance'
import { serializeKeyPoints, unzipPairs, zipKeyPoints } from '@/lib/proposals/key-points'
import { DEFAULT_MAINTENANCE_OFFER, type MaintenanceOffer } from '@/lib/proposals/maintenance'
import { DEFAULT_PROPOSAL_LEGAL_TERMS } from '@/lib/proposals/proposal-acceptance'
import { ensureCalendarYearProration, recurringPaymentTerms } from '@/lib/proposals/recurring'
import {
  DEFAULT_CHANGE_MANAGEMENT_TERMS,
  PAYMENT_SCHEDULE_TEMPLATES,
  paymentPlanForSchedule,
  type PaymentPlanItem,
  type PaymentSchedule,
} from '@/lib/proposals/scope'

import type { ProposalEditorProps } from './proposal-editor-types'

export type InitialProposalDraft = Pick<
  ProposalEditorProps,
  | 'initialTitle'
  | 'initialValidUntil'
  | 'initialNotes'
  | 'initialContextMarkdown'
  | 'initialProblems'
  | 'initialSolutions'
  | 'initialTerms'
  | 'initialScopeModules'
  | 'initialDeliverables'
  | 'initialAcceptanceCriteria'
  | 'initialPaymentSchedule'
  | 'initialPaymentPlan'
  | 'initialPaymentTerms'
  | 'initialChangeManagementTerms'
  | 'initialLegalTerms'
  | 'initialMaintenanceOptions'
  | 'initialMaintenanceSelectedPlanId'
  | 'initialTeamMemberIds'
  | 'initialItems'
  | 'initialCreatedAt'
>

export function createProposalDraft({
  initialTitle,
  initialValidUntil,
  initialNotes,
  initialContextMarkdown,
  initialProblems,
  initialSolutions,
  initialTerms,
  initialScopeModules,
  initialDeliverables,
  initialAcceptanceCriteria,
  initialPaymentSchedule,
  initialPaymentPlan,
  initialPaymentTerms,
  initialChangeManagementTerms,
  initialLegalTerms,
  initialMaintenanceOptions,
  initialMaintenanceSelectedPlanId,
  initialTeamMemberIds,
  initialItems,
  initialCreatedAt,
}: InitialProposalDraft): ProposalDraft {
  const initialBillingItems = ensureCalendarYearProration(initialItems, initialCreatedAt)
  const initialRecurringTerms = recurringPaymentTerms(initialBillingItems, initialCreatedAt)
  const initialSchedule = initialPaymentSchedule ?? 'half_half'
  const hasDefaultPaymentTerms =
    !initialPaymentTerms ||
    (initialSchedule !== 'custom' &&
      initialPaymentTerms === PAYMENT_SCHEDULE_TEMPLATES[initialSchedule])
  const useAutomaticRecurringTerms = Boolean(initialRecurringTerms && hasDefaultPaymentTerms)
  const hasRecurringItems = initialBillingItems.some(
    (item) => item.billing_cycle && item.billing_cycle !== 'none',
  )
  return {
    title: initialTitle,
    validUntil: initialValidUntil ?? '',
    notes: initialNotes ?? '',
    contextMarkdown: initialContextMarkdown ?? '',
    pairs: zipKeyPoints(initialProblems, initialSolutions),
    terms: initialTerms ?? '',
    scopeModules: initialScopeModules,
    deliverables: initialDeliverables ?? '',
    acceptanceCriteria: initialAcceptanceCriteria ?? '',
    paymentSchedule:
      hasRecurringItems && initialPaymentSchedule === 'half_half'
        ? 'custom'
        : (initialPaymentSchedule ?? 'half_half'),
    paymentPlan: hasRecurringItems
      ? []
      : initialPaymentPlan.length > 0
        ? initialPaymentPlan
        : paymentPlanForSchedule(initialPaymentSchedule ?? 'half_half'),
    paymentTerms:
      (useAutomaticRecurringTerms ? initialRecurringTerms : initialPaymentTerms) ??
      PAYMENT_SCHEDULE_TEMPLATES.half_half,
    paymentTermsCustomized: Boolean(
      initialPaymentTerms &&
      !useAutomaticRecurringTerms &&
      !initialPaymentTerms.includes('Las cuotas recurrentes se facturarán'),
    ),
    changeManagementTerms: initialChangeManagementTerms ?? DEFAULT_CHANGE_MANAGEMENT_TERMS,
    legalTerms: initialLegalTerms ?? DEFAULT_PROPOSAL_LEGAL_TERMS,
    maintenanceOptions: initialMaintenanceOptions ?? DEFAULT_MAINTENANCE_OFFER,
    maintenanceSelectedPlanId: initialMaintenanceSelectedPlanId,
    teamMemberIds: initialTeamMemberIds,
    items:
      initialBillingItems.length > 0
        ? initialBillingItems.map((it) => ({ ...it, id: it.id || crypto.randomUUID() }))
        : [{ ...EMPTY_LINE_ITEM, id: crypto.randomUUID() }],
  }
}

export type ProposalDraft = {
  title: string
  validUntil: string
  notes: string
  contextMarkdown: string
  pairs: ReturnType<typeof zipKeyPoints>
  terms: string
  scopeModules: ProposalEditorProps['initialScopeModules']
  deliverables: string
  acceptanceCriteria: string
  paymentSchedule: PaymentSchedule
  paymentPlan: PaymentPlanItem[]
  paymentTerms: string
  paymentTermsCustomized: boolean
  changeManagementTerms: string
  legalTerms: string
  maintenanceOptions: MaintenanceOffer
  maintenanceSelectedPlanId: string | null
  teamMemberIds: string[]
  items: LineItem[]
}

export function proposalDraftPayload(id: string, expectedVersion: number, draft: ProposalDraft) {
  const {
    title,
    validUntil,
    notes,
    contextMarkdown,
    pairs,
    terms,
    scopeModules,
    deliverables,
    acceptanceCriteria,
    paymentSchedule,
    paymentPlan,
    paymentTerms,
    changeManagementTerms,
    legalTerms,
    maintenanceOptions,
    maintenanceSelectedPlanId,
    teamMemberIds,
    items,
  } = draft
  const { problems, solutions } = unzipPairs(pairs)
  return {
    id,
    expected_version: expectedVersion,
    title,
    valid_until: validUntil || null,
    notes: notes || null,
    context_markdown: contextMarkdown || null,
    problems: serializeKeyPoints(problems),
    solutions: serializeKeyPoints(solutions),
    terms: terms || null,
    scope_modules: scopeModules.length > 0 ? scopeModules : null,
    deliverables: deliverables || null,
    acceptance_criteria: acceptanceCriteria || null,
    payment_schedule: paymentSchedule,
    payment_plan: paymentPlan,
    payment_terms: paymentTerms || null,
    change_management_terms: changeManagementTerms || null,
    legal_terms: legalTerms || null,
    maintenance_options: maintenanceOptions,
    maintenance_selected_plan_id: maintenanceSelectedPlanId,
    items,
    team_member_ids: teamMemberIds,
  }
}
