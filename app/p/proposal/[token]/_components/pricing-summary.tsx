import { type computeProposalTotals, roundCurrency } from '@/lib/finance'
import { formatPortalDate, formatPortalEUR } from '@/lib/portal/language'
import type { PaymentPlanItem } from '@/lib/proposals/scope'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import { ProposalPriceBreakdown } from '../proposal-price-breakdown'
import { SectionLabel } from './primitives'

type Totals = ReturnType<typeof computeProposalTotals>

/** Stored titles are Spanish; the standard milestones are translated by id. */
function milestoneTitle(tr: Tr, item: PaymentPlanItem): string {
  switch (item.id) {
    case 'acceptance':
      return tr('Al aceptar', 'En acceptar', 'On acceptance')
    case 'progress':
      return tr('Durante el proyecto', 'Durant el projecte', 'During the project')
    case 'delivery':
      return tr('A la entrega', 'En el lliurament', 'On delivery')
    default:
      return item.title
  }
}

/** When each part of the initial investment is paid, with amounts. */
function PaymentTimeline({
  plan,
  total,
  language,
  tr,
}: {
  plan: PaymentPlanItem[]
  total: number
  language: PortalLanguage
  tr: Tr
}) {
  // The last milestone absorbs rounding so the parts always add up to the total.
  const amounts = plan.map((item) => roundCurrency((total * item.percentage) / 100))
  const paidBefore = amounts.slice(0, -1).reduce((sum, amount) => sum + amount, 0)
  amounts[amounts.length - 1] = roundCurrency(total - paidBefore)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <SectionLabel as="p">{tr('Cómo se paga', 'Com es paga', 'How it is paid')}</SectionLabel>
      <div aria-hidden className="flex h-2 w-full max-w-md gap-1">
        {plan.map((item, index) => (
          <span
            key={item.id}
            style={{ flexGrow: item.percentage }}
            className={`rounded-full ${index === 0 ? 'bg-[#2A4227] dark:bg-[#9CC196]' : 'bg-[#2A4227]/30 dark:bg-[#9CC196]/30'}`}
          />
        ))}
      </div>
      <ol className="flex max-w-md flex-col gap-2">
        {plan.map((item, index) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {item.percentage} %
              </strong>{' '}
              · {milestoneTitle(tr, item)}
              {item.due_date ? (
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {' '}
                  ({formatPortalDate(item.due_date, language)})
                </span>
              ) : null}
            </span>
            <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
              {formatPortalEUR(amounts[index] ?? 0, language)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function PricingSummary({
  totals,
  paymentPlan,
  globalDiscountReason,
  language,
  tr,
}: {
  totals: Totals
  /** Payment milestones; the timeline is hidden when there is a single payment. */
  paymentPlan: PaymentPlanItem[]
  globalDiscountReason: string | null
  language: PortalLanguage
  tr: Tr
}) {
  const recurringBuckets = [
    { title: tr('Mensual', 'Mensual', 'Monthly'), bucket: totals.monthly },
    { title: tr('Trimestral', 'Trimestral', 'Quarterly'), bucket: totals.quarterly },
    { title: tr('Anual', 'Anual', 'Yearly'), bucket: totals.yearly },
  ].filter(({ bucket }) => bucket.total > 0)

  return (
    <div className="flex flex-col gap-6 border-t border-zinc-200 px-8 py-5 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
      {paymentPlan.length > 1 && totals.oneTime.total > 0 ? (
        <PaymentTimeline
          plan={paymentPlan}
          total={totals.oneTime.total}
          language={language}
          tr={tr}
        />
      ) : (
        <div className="hidden sm:block" />
      )}
      <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-64 sm:shrink-0">
        <ProposalPriceBreakdown
          title={tr('Inversión inicial', 'Inversió inicial', 'Initial investment')}
          subtotal={totals.oneTime.subtotal}
          taxAmount={totals.oneTime.taxAmount}
          total={totals.oneTime.total}
          language={language}
          discounts={{ ...totals.discounts, globalReason: globalDiscountReason }}
        />

        {recurringBuckets.length > 0 ? (
          <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <SectionLabel as="p">
              {tr('Mantenimiento recurrente', 'Manteniment recurrent', 'Recurring maintenance')}
            </SectionLabel>
            {recurringBuckets.map(({ title, bucket }) => (
              <ProposalPriceBreakdown
                key={title}
                title={title}
                subtotal={bucket.subtotal}
                taxAmount={bucket.taxAmount}
                total={bucket.total}
                language={language}
                compact
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
