import { ArrowDown, ArrowRight } from 'lucide-react'

import type { computeProposalTotals } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import { PROPOSAL_ACTION_CLASS } from './primitives'
import { RespondButton } from './respond-controls'

type Totals = ReturnType<typeof computeProposalTotals>

/** A concise initial investment with a link to the detailed pricing. */
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
  return (
    <section
      aria-label={tr('Resumen de la propuesta', 'Resum de la proposta', 'Proposal summary')}
      className="mx-auto max-w-3xl px-2 py-10 sm:px-6 sm:py-12"
    >
      <dl className="text-center">
        <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {tr('Inversión inicial', 'Inversió inicial', 'Initial investment')}
        </dt>
        <dd className="mt-2">
          <a
            href="#inversion"
            className="inline-flex flex-col items-center gap-2 rounded-lg text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950 dark:text-white"
          >
            <span className="text-2xl font-semibold tracking-tight break-words tabular-nums sm:text-4xl">
              {formatPortalEUR(totals.oneTime.subtotal, language)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-600 underline underline-offset-2 dark:text-zinc-400">
              {tr(
                'Sin IVA · Ver desglose',
                'Sense IVA · Veure desglossament',
                'Excl. VAT · View breakdown',
              )}
              <ArrowDown aria-hidden className="size-3" />
            </span>
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
