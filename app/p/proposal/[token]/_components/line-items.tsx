import type { BillingCycle } from '@/lib/finance'
import { roundCurrency } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'

import { billingCycleText, type PortalLanguage, type Tr } from '../_lib/i18n'
import type { ProposalItem } from '../_lib/types'
import { SectionLabel } from './primitives'

function LineSubtotal({ item, language }: { item: ProposalItem; language: PortalLanguage }) {
  const discount = Number(item.discount_percent ?? 0)
  if (discount <= 0) return <>{formatPortalEUR(item.subtotal, language)}</>
  return (
    <>
      <span className="block text-xs font-normal text-zinc-500 line-through dark:text-zinc-400">
        {formatPortalEUR(item.subtotal, language)}
      </span>
      {formatPortalEUR(roundCurrency(item.subtotal * (1 - discount / 100)), language)}
      <span className="block text-xs font-normal text-emerald-800 dark:text-emerald-400">
        −{discount}%{item.discount_reason ? ` · ${item.discount_reason}` : ''}
      </span>
    </>
  )
}

const TH = 'py-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400'

function LineItemsTable({
  items,
  hasRecurring,
  language,
  tr,
}: {
  items: ProposalItem[]
  hasRecurring: boolean
  language: PortalLanguage
  tr: Tr
}) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-sm">
        <caption className="sr-only">
          {tr('Líneas de la propuesta', 'Línies de la proposta', 'Proposal line items')}
        </caption>
        <thead className="bg-zinc-50 dark:bg-zinc-900/60">
          <tr className="border-y border-zinc-200 dark:border-zinc-800">
            <th scope="col" className={`${TH} px-8 text-left`}>
              {tr('Descripción', 'Descripció', 'Description')}
            </th>
            {hasRecurring ? (
              <th scope="col" className={`${TH} px-4 text-left`}>
                {tr('Cadencia', 'Periodicitat', 'Billing cycle')}
              </th>
            ) : null}
            <th scope="col" className={`${TH} px-4 text-right`}>
              {tr('Cant.', 'Quant.', 'Qty.')}
            </th>
            <th scope="col" className={`${TH} px-4 text-right`}>
              {tr('Precio', 'Preu', 'Price')}
            </th>
            <th scope="col" className={`${TH} px-4 text-right`}>
              {tr('IVA', 'IVA', 'VAT')}
            </th>
            <th scope="col" className={`${TH} px-8 text-right`}>
              {tr('Subtotal', 'Subtotal', 'Subtotal')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {items.map((item) => {
            const cycle: BillingCycle = item.billing_cycle ?? 'none'
            return (
              <tr key={item.id} className="align-top">
                <th
                  scope="row"
                  className="px-8 py-4 text-left font-medium text-zinc-900 dark:text-zinc-100"
                >
                  {item.description}
                </th>
                {hasRecurring ? (
                  <td className="px-4 py-4 text-left text-xs">
                    {cycle === 'none' ? (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {tr('Único', 'Únic', 'One-time')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[#2A4227]/10 px-2.5 py-0.5 font-medium text-[#2A4227] dark:bg-[#9CC196]/10 dark:text-[#9CC196]">
                        {billingCycleText(tr, cycle)}
                      </span>
                    )}
                  </td>
                ) : null}
                <td className="px-4 py-4 text-right text-zinc-700 tabular-nums dark:text-zinc-300">
                  {item.quantity}
                </td>
                <td className="px-4 py-4 text-right text-zinc-700 tabular-nums dark:text-zinc-300">
                  {formatPortalEUR(item.unit_price, language)}
                </td>
                <td className="px-4 py-4 text-right text-zinc-700 tabular-nums dark:text-zinc-300">
                  {item.vat_rate}%
                </td>
                <td className="px-8 py-4 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                  <LineSubtotal item={item} language={language} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Mobile: one card per line, no horizontal scroll. */
function LineItemsList({
  items,
  language,
  tr,
}: {
  items: ProposalItem[]
  language: PortalLanguage
  tr: Tr
}) {
  return (
    <ul className="divide-y divide-zinc-100 border-t border-zinc-200 sm:hidden dark:divide-zinc-800/60 dark:border-zinc-800">
      {items.map((item) => {
        const cycle: BillingCycle = item.billing_cycle ?? 'none'
        return (
          <li key={item.id} className="px-6 py-4">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {item.description}
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {item.quantity} × {formatPortalEUR(item.unit_price, language)}
                {' · '}
                {tr('IVA', 'IVA', 'VAT')} {item.vat_rate}%
                {cycle !== 'none' ? ` · ${billingCycleText(tr, cycle)}` : ''}
              </p>
              <p className="shrink-0 text-right text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                <LineSubtotal item={item} language={language} />
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function LineItems({
  items,
  hasRecurring,
  language,
  tr,
}: {
  items: ProposalItem[]
  hasRecurring: boolean
  language: PortalLanguage
  tr: Tr
}) {
  return (
    <section
      aria-labelledby="proposal-investment"
      className="border-t border-zinc-200 dark:border-zinc-800"
    >
      <SectionLabel className="px-6 pt-6 pb-3 sm:px-8">
        <span id="proposal-investment">
          {tr('Detalle de la inversión', 'Detall de la inversió', 'Investment breakdown')}
        </span>
      </SectionLabel>
      {items.length === 0 ? (
        <p className="px-6 py-5 text-sm text-zinc-600 sm:px-8 dark:text-zinc-400">
          {tr('Sin líneas.', 'Sense línies.', 'No line items.')}
        </p>
      ) : (
        <>
          <LineItemsTable items={items} hasRecurring={hasRecurring} language={language} tr={tr} />
          <LineItemsList items={items} language={language} tr={tr} />
        </>
      )}
    </section>
  )
}
