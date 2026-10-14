import { formatPortalEUR } from '@/lib/portal/language'

type Props = {
  title: string
  subtotal: number
  taxAmount: number
  total: number
  language: 'es' | 'ca' | 'en'
  compact?: boolean
  /** Optional discount detail (one-time bucket only). */
  discounts?: {
    gross: number
    lineDiscount: number
    globalDiscount: number
    globalReason?: string | null
  }
}

export function ProposalPriceBreakdown({
  title,
  subtotal,
  taxAmount,
  total,
  language,
  compact = false,
  discounts,
}: Props) {
  const hasDiscount = !!discounts && (discounts.lineDiscount > 0 || discounts.globalDiscount > 0)
  const copy =
    language === 'ca'
      ? {
          gross: 'Import brut',
          lineDiscount: 'Descomptes en partides',
          globalDiscount: 'Descompte',
          beforeTax: 'Import abans d’IVA',
          tax: 'IVA aplicable',
          total: 'Total previst amb IVA',
        }
      : language === 'en'
        ? {
            gross: 'Gross amount',
            lineDiscount: 'Line discounts',
            globalDiscount: 'Discount',
            beforeTax: 'Amount before VAT',
            tax: 'Applicable VAT',
            total: 'Estimated total incl. VAT',
          }
        : {
            gross: 'Importe bruto',
            lineDiscount: 'Descuentos en partidas',
            globalDiscount: 'Descuento',
            beforeTax: 'Importe antes de IVA',
            tax: 'IVA aplicable',
            total: 'Total previsto con IVA',
          }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
        {title}
      </p>
      {hasDiscount && discounts ? (
        <div className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex justify-between gap-3">
            <span>{copy.gross}</span>
            <span className="tabular-nums">{formatPortalEUR(discounts.gross, language)}</span>
          </div>
          {discounts.lineDiscount > 0 ? (
            <div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-400">
              <span>{copy.lineDiscount}</span>
              <span className="tabular-nums">
                −{formatPortalEUR(discounts.lineDiscount, language)}
              </span>
            </div>
          ) : null}
          {discounts.globalDiscount > 0 ? (
            <div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-400">
              <span>
                {copy.globalDiscount}
                {discounts.globalReason ? ` · ${discounts.globalReason}` : ''}
              </span>
              <span className="tabular-nums">
                −{formatPortalEUR(discounts.globalDiscount, language)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      <p
        className={`${compact ? 'text-lg' : 'text-2xl'} font-semibold text-zinc-900 tabular-nums dark:text-zinc-100`}
      >
        {formatPortalEUR(subtotal, language)}
      </p>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{copy.beforeTax}</p>
      <div className="mt-1 flex justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{copy.tax}</span>
        <span className="tabular-nums">{formatPortalEUR(taxAmount, language)}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
        <span>{copy.total}</span>
        <span className="tabular-nums">{formatPortalEUR(total, language)}</span>
      </div>
    </div>
  )
}
