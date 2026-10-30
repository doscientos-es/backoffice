import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import type { computeProposalTotals } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import { RespondButton } from './respond-controls'

type Totals = ReturnType<typeof computeProposalTotals>

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl dark:text-zinc-100">
        {children}
      </dd>
      {hint ? <p className="text-xs text-zinc-600 dark:text-zinc-400">{hint}</p> : null}
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
      className="border-b border-zinc-200 bg-gradient-to-b from-[#2A4227]/[0.06] to-transparent px-6 py-6 sm:px-8 dark:border-zinc-800 dark:from-[#9CC196]/[0.07]"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
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
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <RespondButton className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2A4227] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1f3320] focus-visible:ring-2 focus-visible:ring-[#2A4227] focus-visible:ring-offset-2 focus-visible:outline-none">
            {tr('Revisar y aceptar', 'Revisar i acceptar', 'Review and accept')}
            <ArrowRight aria-hidden className="size-4" />
          </RespondButton>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
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
