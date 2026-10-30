import type { computeProposalTotals } from '@/lib/finance'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import { ProposalPriceBreakdown } from '../proposal-price-breakdown'
import { SectionLabel } from './primitives'

type Totals = ReturnType<typeof computeProposalTotals>

export function PricingSummary({
  totals,
  globalDiscountReason,
  language,
  tr,
}: {
  totals: Totals
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
    <div className="flex justify-end border-t border-zinc-200 px-8 py-5 dark:border-zinc-800">
      <div className="flex w-64 flex-col gap-3">
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
