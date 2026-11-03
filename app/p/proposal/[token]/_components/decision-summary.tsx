import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import type { computeProposalTotals } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import { PROPOSAL_ACTION_CLASS } from './primitives'
import { RespondButton } from './respond-controls'

type Totals = ReturnType<typeof computeProposalTotals>

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tracking-tight break-words text-zinc-950 tabular-nums sm:text-4xl dark:text-white">
        {children}
        {hint ? (
          <span className="mt-1 block text-xs leading-relaxed font-normal tracking-normal text-zinc-500 dark:text-zinc-400">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  )
}

/**
 * First thing the lead sees under the title: what it costs, what is due today,
 * how long it takes and the single next action. Everything shown is derived from
 * the proposal itself; a stat is omitted when the data is not there.
 */
export function DecisionSummary({
  language,
  tr,
  totals,
  depositAmount,
  initialPaymentPercentage,
  totalWeeks,
  canRespond,
}: {
  language: PortalLanguage
  tr: Tr
  totals: Totals
  depositAmount: number | null
  initialPaymentPercentage: number | null
  totalWeeks: number | null
  canRespond: boolean
}) {
  const recurring = [
    { bucket: totals.monthly, suffix: tr('/mes', '/mes', '/month') },
    { bucket: totals.quarterly, suffix: tr('/trimestre', '/trimestre', '/quarter') },
    { bucket: totals.yearly, suffix: tr('/año', '/any', '/year') },
  ].filter(({ bucket }) => bucket.total > 0)

  return (
    <section
      aria-label={tr('Resumen de la propuesta', 'Resum de la proposta', 'Proposal summary')}
      className="mx-auto max-w-3xl px-2 py-10 sm:px-6 sm:py-12"
    >
      <dl className="flex flex-wrap justify-center gap-x-10 gap-y-8 sm:gap-x-16">
        <Stat
          label={tr('Inversión', 'Inversió', 'Investment')}
          hint={tr('IVA incluido', 'IVA inclòs', 'VAT included')}
        >
          {formatPortalEUR(totals.oneTime.total, language)}
        </Stat>
        {depositAmount !== null && initialPaymentPercentage !== null ? (
          <Stat
            label={tr('Para empezar', 'Per començar', 'To get started')}
            hint={`${initialPaymentPercentage} % ${tr('al aceptar', 'en acceptar', 'on acceptance')}`}
          >
            {formatPortalEUR(depositAmount, language)}
          </Stat>
        ) : null}
        {totalWeeks ? (
          <Stat
            label={tr('Plazo estimado', 'Termini estimat', 'Estimated timeline')}
            hint={tr('Según los módulos', 'Segons els mòduls', 'Based on the modules')}
          >
            {tr(`hasta ${totalWeeks} sem.`, `fins a ${totalWeeks} set.`, `up to ${totalWeeks} wk`)}
          </Stat>
        ) : null}
        {recurring.length > 0 ? (
          <Stat
            label={tr('Después', 'Després', 'Afterwards')}
            hint={tr('Mantenimiento recurrente', 'Manteniment recurrent', 'Recurring maintenance')}
          >
            {recurring.map(({ bucket, suffix }) => (
              <span key={suffix} className="block">
                {formatPortalEUR(bucket.total, language)}
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {suffix}
                </span>
              </span>
            ))}
          </Stat>
        ) : null}
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
