import { ArrowRight } from 'lucide-react'

import type { computeProposalTotals } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import { PROPOSAL_ACTION_CLASS } from './primitives'
import { RespondButton } from './respond-controls'

type Totals = ReturnType<typeof computeProposalTotals>

/** A concise investment with a link to the detailed pricing. */
export function DecisionSummary({
  language,
  tr,
  totals,
  canRespond,
}: {
  language: PortalLanguage
  tr: Tr
  totals: Totals
  canRespond: boolean
}) {
  const amount = formatPortalEUR(totals.oneTime.subtotal, language)
  const breakdownLabel = tr(
    'Ver desglose de la inversión',
    'Veure desglossament de la inversió',
    'View investment breakdown',
  )

  return (
    <section
      aria-label={tr('Resumen de la propuesta', 'Resum de la proposta', 'Proposal summary')}
      className="mx-auto max-w-3xl px-2 py-10 sm:px-6 sm:py-12"
    >
      <dl className="text-center">
        <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {tr('Inversión', 'Inversió', 'Investment')}
        </dt>
        <dd className="mt-2">
          <a
            href="#inversion"
            title={breakdownLabel}
            aria-label={`${breakdownLabel}: ${amount}`}
            className="inline-block rounded-lg text-2xl font-semibold tracking-tight break-words text-zinc-950 tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950 sm:text-4xl dark:text-white"
          >
            {amount}
          </a>
        </dd>
      </dl>
      {canRespond ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <RespondButton
            className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold ${PROPOSAL_ACTION_CLASS}`}
          >
            {tr('Revisar y aceptar', 'Revisar i acceptar', 'Review and accept')}
            <ArrowRight aria-hidden className="size-4" />
          </RespondButton>
          <p className="max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {tr(
              'Sin compromiso hasta que firmes. Puedes preguntarnos lo que quieras antes.',
              'Sense compromís fins que signis. Ens pots preguntar el que vulguis abans.',
              'No commitment until you sign. Ask us anything first.',
            )}
          </p>
        </div>
      ) : null}
    </section>
  )
}
