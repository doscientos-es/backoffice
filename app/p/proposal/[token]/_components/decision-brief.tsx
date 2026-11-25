import type { computeProposalTotals } from '@/lib/finance'
import { formatPortalDate, formatPortalEUR } from '@/lib/portal/language'
import type { parseKeyPoints } from '@/lib/proposals/key-points'
import type { MaintenanceOffer } from '@/lib/proposals/maintenance'
import type { ScopeModule } from '@/lib/proposals/scope'

import { billingCycleText, makeTr, type PortalLanguage } from '../_lib/i18n'
import type { ProposalItem } from '../_lib/types'
import { ShareDecisionBrief } from './share-decision-brief'

type Props = {
  token: string
  language: PortalLanguage
  title: string
  number: string
  recipient: string
  statusLabel: string
  validUntil: string | null
  totals: ReturnType<typeof computeProposalTotals>
  items: ProposalItem[]
  scopeModules: ScopeModule[]
  solutions: ReturnType<typeof parseKeyPoints>
  maintenanceOffer: MaintenanceOffer
  canRespond: boolean
  isDraft: boolean
}

export function DecisionBrief({
  token,
  language,
  title,
  number,
  recipient,
  statusLabel,
  validUntil,
  totals,
  items,
  scopeModules,
  solutions,
  maintenanceOffer,
  canRespond,
  isDraft,
}: Props) {
  const tr = makeTr(language)
  const proposalUrl = `/p/proposal/${encodeURIComponent(token)}?lang=${language}`
  const summaryUrl = `/p/proposal/${encodeURIComponent(token)}?view=summary&lang=${language}`
  const scope = scopeModules.length
    ? scopeModules.map((module) => ({ id: module.id, title: module.title }))
    : solutions.length
      ? solutions.map((solution) => ({ id: solution.id, title: solution.title }))
      : items
          .filter((item) => !item.billing_cycle || item.billing_cycle === 'none')
          .map((item) => ({ id: item.id, title: item.description }))
  const recurring = (['monthly', 'quarterly', 'yearly'] as const).filter((cycle) =>
    items.some((item) => item.billing_cycle === cycle),
  )

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
        <header className="border-b border-zinc-200 px-6 py-8 sm:px-10 dark:border-zinc-800">
          <h1 className="text-3xl font-semibold tracking-tight break-words">{title}</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {tr('Resumen de propuesta', 'Resum de proposta', 'Proposal summary')} · {number}
          </p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {tr('Para', 'Per a', 'Prepared for')} {recipient} · {statusLabel}
          </p>
          {validUntil ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {tr('Válida hasta', 'Vàlida fins al', 'Valid until')}{' '}
              {formatPortalDate(validUntil, language)}
            </p>
          ) : null}
          {isDraft ? (
            <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">
              {tr(
                'Borrador: solo visible para el equipo.',
                'Esborrany: només visible per a l’equip.',
                'Draft: visible to the team only.',
              )}
            </p>
          ) : null}
        </header>
        <div className="space-y-8 px-6 py-8 sm:px-10">
          {scope.length ? (
            <section>
              <h2 className="text-lg font-semibold">
                {tr('Qué incluye', 'Què inclou', 'What is included')}
              </h2>
              <ul className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2 dark:text-zinc-300">
                {scope.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{item.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="text-lg font-semibold">{tr('Inversión', 'Inversió', 'Investment')}</h2>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatPortalEUR(totals.oneTime.subtotal, language)}{' '}
              <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">
                {tr('sin IVA', 'sense IVA', 'excl. VAT')}
              </span>
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {formatPortalEUR(totals.oneTime.total, language)}{' '}
              {tr('con IVA', 'amb IVA', 'incl. VAT')}
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">
              {tr(
                'Costes recurrentes incluidos',
                'Costos recurrents inclosos',
                'Included recurring costs',
              )}
            </h2>
            {recurring.length ? (
              <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {recurring.map((cycle) => (
                  <li key={cycle}>
                    {billingCycleText(tr, cycle)}:{' '}
                    {formatPortalEUR(totals[cycle].subtotal, language)}{' '}
                    {tr('sin IVA', 'sense IVA', 'excl. VAT')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {tr(
                  'No hay cuotas recurrentes en las partidas de la propuesta.',
                  'No hi ha quotes recurrents a les partides de la proposta.',
                  'There are no recurring charges in the proposal line items.',
                )}
              </p>
            )}
          </section>
          {maintenanceOffer.enabled ? (
            <section>
              <h2 className="text-lg font-semibold">
                {tr('Opciones de mantenimiento', 'Opcions de manteniment', 'Maintenance options')}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {tr(
                  'No incluidas en la inversión inicial.',
                  'No incloses en la inversió inicial.',
                  'Not included in the initial investment.',
                )}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {maintenanceOffer.plans.map((plan) => (
                  <li key={plan.id}>
                    {plan.name}: {formatPortalEUR(plan.monthly_price, language)}{' '}
                    {tr('/ mes sin IVA', '/ mes sense IVA', '/ month excl. VAT')}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="text-lg font-semibold">
              {tr('Próximo paso', 'Pas següent', 'Next step')}
            </h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {canRespond
                ? tr(
                    'Revisa la propuesta completa y, si estás de acuerdo, acéptala desde allí.',
                    'Revisa la proposta completa i, si hi estàs d’acord, accepta-la des d’allà.',
                    'Review the full proposal and accept it there if you agree.',
                  )
                : tr(
                    'Consulta la propuesta completa para ver su estado y condiciones.',
                    'Consulta la proposta completa per veure’n l’estat i les condicions.',
                    'View the full proposal for its status and terms.',
                  )}
            </p>
            <a
              href={proposalUrl}
              className="mt-4 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            >
              {tr('Ver propuesta completa', 'Veure proposta completa', 'View full proposal')}
            </a>
          </section>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {tr(
              'Este resumen refleja la propuesta actual. Consulta la propuesta completa para el alcance y las condiciones.',
              'Aquest resum reflecteix la proposta actual. Consulta la proposta completa per a l’abast i les condicions.',
              'This summary reflects the current proposal. See the full proposal for scope and terms.',
            )}
          </p>
        </div>
      </article>
      {!isDraft ? <ShareDecisionBrief path={summaryUrl} title={title} language={language} /> : null}
    </main>
  )
}
