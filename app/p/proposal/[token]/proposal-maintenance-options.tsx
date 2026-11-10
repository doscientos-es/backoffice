import { formatPortalEUR } from '@/lib/portal/language'
import { type MaintenanceOffer, recommendedMaintenancePlanId } from '@/lib/proposals/maintenance'

import { SectionLabel } from './_components/primitives'

export function ProposalMaintenanceOptions({
  offer,
  language = 'es',
}: {
  offer: MaintenanceOffer
  language?: 'es' | 'ca' | 'en'
}) {
  const recommendedPlanId = recommendedMaintenancePlanId(offer)
  const copy =
    language === 'ca'
      ? {
          heading: 'Opcions de manteniment',
          intro:
            'Aquestes opcions no estan incloses en l’import de la proposta. Destaquem la nostra recomanació.',
          month: '/ mes + IVA',
          recommended: 'Recomanat',
          includes: 'Inclou',
          excludes: 'No inclou',
        }
      : language === 'en'
        ? {
            heading: 'Maintenance options',
            intro:
              'These options are not included in the proposal amount. Our recommendation is highlighted.',
            month: '/ month + VAT',
            recommended: 'Recommended',
            includes: 'Includes',
            excludes: 'Does not include',
          }
        : {
            heading: 'Opciones de mantenimiento',
            intro:
              'Estas opciones no están incluidas en el importe de la propuesta. Destacamos nuestra recomendación.',
            month: '/ mes + IVA',
            recommended: 'Recomendado',
            includes: 'Incluye',
            excludes: 'No incluye',
          }
  const money = (amount: number) => formatPortalEUR(amount, language)

  return (
    <section className="border-t border-zinc-100 bg-[#2A4227]/3 px-6 py-7 sm:px-8 dark:border-zinc-800/60 dark:bg-[#9CC196]/4">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold tracking-widest text-[#2A4227] uppercase dark:text-[#9CC196]">
          {offer.heading}
        </p>
        <SectionLabel className="mt-2">{copy.heading}</SectionLabel>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{offer.intro}</p>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {copy.intro}
        </p>
      </header>
      <div
        className={`mt-5 grid gap-3 ${offer.plans.length === 1 ? '' : offer.plans.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}
      >
        {offer.plans.map((plan) => {
          const recommended = recommendedPlanId === plan.id
          return (
            <article
              key={plan.id}
              className={`rounded-lg border p-4 ${recommended ? 'border-[#2A4227]/50 bg-[#2A4227]/3 dark:border-[#9CC196]/60 dark:bg-[#9CC196]/5' : 'border-zinc-200 dark:border-zinc-800'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
                  <p className="mt-1 text-lg font-bold text-[#2A4227] dark:text-[#9CC196]">
                    {money(plan.monthly_price)}{' '}
                    <span className="text-xs font-medium">{copy.month}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {recommended ? (
                    <span className="rounded-full bg-[#2A4227] px-2 py-1 text-[10px] font-semibold tracking-wide text-white uppercase dark:bg-[#9CC196] dark:text-[#1a2b18]">
                      {copy.recommended}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{plan.summary}</p>
              <p className="mt-4 text-[11px] font-semibold tracking-wide text-[#2A4227] uppercase dark:text-[#9CC196]">
                {copy.includes}
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                {plan.coverage.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {plan.exclusions.length > 0 ? (
                <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
                  <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                    {copy.excludes}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {plan.exclusions.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden>—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
