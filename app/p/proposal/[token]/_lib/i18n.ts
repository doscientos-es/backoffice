import { BILLING_CYCLE_LABELS, type BillingCycle } from '@/lib/finance'
import type { ProposalStatus } from '@/lib/status'

export type PortalLanguage = 'es' | 'ca' | 'en'
export type Tr = (es: string, ca: string, en: string) => string

/** Label for a recurring billing cycle (`none` has no label). */
export function billingCycleText(tr: Tr, cycle: Exclude<BillingCycle, 'none'>): string {
  return tr(
    BILLING_CYCLE_LABELS[cycle],
    cycle === 'monthly' ? 'Mensual' : cycle === 'quarterly' ? 'Trimestral' : 'Anual',
    cycle === 'monthly' ? 'Monthly' : cycle === 'quarterly' ? 'Quarterly' : 'Yearly',
  )
}

/** Picks the string for the active portal language: `tr('es', 'ca', 'en')`. */
export function makeTr(language: PortalLanguage): Tr {
  return (es, ca, en) => (language === 'ca' ? ca : language === 'en' ? en : es)
}

const COPY = {
  es: {
    proposal: 'Propuesta',
    validUntil: 'Válida hasta el',
    download: 'Descargar PDF',
    recipient: 'Dirigido a',
    draft: 'Borrador',
    teamOnly: 'Vista previa — solo visible para el equipo',
    confirmed: 'Pago confirmado',
    paymentError: 'Error en el pago',
  },
  ca: {
    proposal: 'Proposta',
    validUntil: 'Vàlida fins al',
    download: 'Descarregar PDF',
    recipient: 'Adreçada a',
    draft: 'Esborrany',
    teamOnly: 'Vista prèvia — només visible per a l’equip',
    confirmed: 'Pagament confirmat',
    paymentError: 'Error en el pagament',
  },
  en: {
    proposal: 'Proposal',
    validUntil: 'Valid until',
    download: 'Download PDF',
    recipient: 'Prepared for',
    draft: 'Draft',
    teamOnly: 'Preview — visible to the team only',
    confirmed: 'Payment confirmed',
    paymentError: 'Payment error',
  },
} as const

export type PortalCopy = (typeof COPY)[PortalLanguage]

export function getPortalCopy(language: PortalLanguage): PortalCopy {
  return COPY[language]
}

/** Human label for the proposal status pill. Anything not final reads as pending. */
export function getStatusLabel(language: PortalLanguage, status: ProposalStatus): string {
  const tr = makeTr(language)
  switch (status) {
    case 'draft':
      return tr('Vista previa del equipo', 'Vista prèvia de l’equip', 'Team preview')
    case 'accepted':
      return tr('Aceptada', 'Acceptada', 'Accepted')
    case 'rejected':
      return tr('No aceptada', 'No acceptada', 'Declined')
    case 'expired':
      return tr('Caducada', 'Vençuda', 'Expired')
    default:
      return tr('Pendiente de tu respuesta', 'Pendent de resposta', 'Awaiting your response')
  }
}
