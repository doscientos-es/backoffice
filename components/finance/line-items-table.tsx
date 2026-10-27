'use client'

import { Copy, Plus, Trash as Trash2 } from 'lucide-react'
import { useRef } from 'react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLES,
  type BillingCycle,
  computeLineSubtotal,
  computeLineTotals,
  computeProposalTotals,
  type DiscountType,
  EMPTY_LINE_ITEM,
  type LineItem,
  normalizeDiscountPercent,
  roundCurrency,
} from '@/lib/finance'
import { formatEUR } from '@/lib/utils'

export type LineItemsTableProps = {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  /** When true, every input is disabled. Used by invoice/proposal edit views. */
  locked?: boolean
  /**
   * When true, renders the cadence selector per line and a bucketed totals
   * footer (one-time + recurring). Used by proposals; invoices keep the
   * one-shot layout.
   */
  showBillingCycle?: boolean
  /** Whole-proposal discount (proposals only; requires `onDiscountChange`). */
  discount?: { type: DiscountType; value: number; reason: string }
  onDiscountChange?: (next: { type: DiscountType; value: number; reason: string }) => void
}

const RECURRING_CYCLES: ReadonlyArray<Exclude<BillingCycle, 'none'>> = [
  'monthly',
  'quarterly',
  'yearly',
]

/**
 * Editable line-items table shared by invoice and proposal editors. Owns the
 * desglose UI (Subtotal / IVA / Total) so callers only deal with the items
 * array; totals are derived via `computeLineTotals` or, when cadence is
 * enabled, via `computeProposalTotals` (one-time + recurring buckets).
 */
export function LineItemsTable({
  items,
  onChange,
  locked = false,
  showBillingCycle = false,
  discount,
  onDiscountChange,
}: LineItemsTableProps) {
  const flatRaw = computeLineTotals(items)
  const bucketed = computeProposalTotals(
    items,
    discount ? { type: discount.type, value: discount.value } : null,
  )
  const lineNet = (it: LineItem) =>
    roundCurrency(
      computeLineSubtotal(it) * (1 - normalizeDiscountPercent(it.discount_percent) / 100),
    )
  const showDiscounts = showBillingCycle
  // Proposals: totals must reflect discounts, so use the bucketed grand total.
  const flat = showBillingCycle ? bucketed.grand : flatRaw
  const recurringRows = showBillingCycle
    ? RECURRING_CYCLES.filter((c) => bucketed[c].total > 0)
    : []
  const descriptionRefs = useRef(new Map<string, HTMLInputElement>())

  const update = (i: number, patch: Partial<LineItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const focusDescription = (id: string) => {
    requestAnimationFrame(() => descriptionRefs.current.get(id)?.focus())
  }
  const add = () => {
    const id = crypto.randomUUID()
    onChange([...items, { ...EMPTY_LINE_ITEM, id }])
    focusDescription(id)
  }
  const duplicate = (i: number) => {
    const source = items[i]
    if (!source) return
    const copy: LineItem = { ...source, id: crypto.randomUUID() }
    onChange([...items.slice(0, i + 1), copy, ...items.slice(i + 1)])
    focusDescription(copy.id)
  }
  const remove = (i: number) =>
    onChange(items.length === 1 ? items : items.filter((_, idx) => idx !== i))

  const columns = showBillingCycle
    ? 'md:grid-cols-[minmax(12rem,1fr)_8rem_5rem_8rem_5rem_6rem_8rem_5rem]'
    : 'md:grid-cols-[minmax(12rem,1fr)_5rem_8rem_6rem_8rem_5rem]'
  // Proposals, medium widths: two rows per item (description + importe + actions
  // on top; cadence, quantity, price, discount, VAT below). Below 480px it stacks.
  const n = (cls: string) => (showBillingCycle ? cls : '')
  const reset = 'md:order-none md:col-span-1'
  const cDesc = n(`min-[480px]:order-1 min-[480px]:col-span-6 ${reset}`)
  const cCycle = n(`min-[480px]:order-4 min-[480px]:col-span-3 ${reset}`)
  const cQty = n(`min-[480px]:order-4 min-[480px]:col-span-2 ${reset}`)
  const cPrice = n(`min-[480px]:order-4 min-[480px]:col-span-3 ${reset}`)
  const cDisc = n(`min-[480px]:order-4 min-[480px]:col-span-2 ${reset}`)
  const cVat = n(`min-[480px]:order-4 min-[480px]:col-span-2 ${reset}`)
  const cAmount = n(`min-[480px]:order-2 min-[480px]:col-span-3 min-[480px]:items-end ${reset}`)
  const cActions = n(`min-[480px]:order-3 min-[480px]:col-span-3 ${reset}`)
  const cReason = n(`min-[480px]:order-5 min-[480px]:col-span-12 md:order-none`)

  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain">
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="sr-only">Líneas de factura</legend>
        <div
          className={`hidden items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid ${columns}`}
        >
          <span>Descripción</span>
          {showBillingCycle && <span>Cadencia</span>}
          <span className="text-right">Cantidad</span>
          <span className="text-right">Precio unitario</span>
          {showDiscounts && <span className="text-right">Dto.</span>}
          <span className="text-right">IVA</span>
          <span className="text-right">Importe</span>
          <span className="sr-only">Acciones</span>
        </div>

        <div className="divide-y divide-border">
          {items.map((it, i) => (
            <div
              key={it.id}
              className={`grid grid-cols-2 items-start gap-3 p-4 transition-colors focus-within:bg-muted/25 md:items-center md:gap-2 md:px-3 md:py-2.5 ${n('min-[480px]:grid-cols-12 min-[480px]:items-end min-[480px]:gap-x-2 min-[480px]:gap-y-2 min-[480px]:p-3')} ${columns}`}
            >
              <div className={`col-span-2 md:col-span-1 ${cDesc}`}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                  Descripción
                </span>
                <Input
                  ref={(node) => {
                    if (node) descriptionRefs.current.set(it.id, node)
                    else descriptionRefs.current.delete(it.id)
                  }}
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !locked) {
                      e.preventDefault()
                      add()
                    }
                  }}
                  disabled={locked}
                  placeholder="Servicio o producto"
                  maxLength={500}
                  aria-label={`Descripción línea ${i + 1}`}
                />
              </div>

              {showBillingCycle && (
                <div className={cCycle}>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                    Cadencia
                  </span>
                  <Select
                    value={it.billing_cycle ?? 'none'}
                    onChange={(e) => update(i, { billing_cycle: e.target.value as BillingCycle })}
                    disabled={locked}
                    aria-label={`Cadencia línea ${i + 1}`}
                  >
                    {BILLING_CYCLES.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {BILLING_CYCLE_LABELS[cycle]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className={cQty}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                  Cantidad
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={it.quantity || ''}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
                  disabled={locked}
                  className="text-right tabular-nums"
                  aria-label={`Cantidad línea ${i + 1}`}
                />
              </div>

              <div className={cPrice}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                  Precio unitario
                </span>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={it.unit_price || ''}
                    onChange={(e) => update(i, { unit_price: Number(e.target.value) || 0 })}
                    disabled={locked}
                    className="pr-8 text-right tabular-nums"
                    aria-label={`Precio unitario línea ${i + 1}`}
                  />
                  <span
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                    aria-hidden="true"
                  >
                    €
                  </span>
                </div>
              </div>

              {showDiscounts && (
                <div className={cDisc}>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                    Descuento
                  </span>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      max="100"
                      value={it.discount_percent || ''}
                      onChange={(e) =>
                        update(i, { discount_percent: normalizeDiscountPercent(e.target.value) })
                      }
                      disabled={locked}
                      className="pr-8 text-right tabular-nums"
                      aria-label={`Descuento línea ${i + 1}`}
                    />
                    <span
                      className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                      aria-hidden="true"
                    >
                      %
                    </span>
                  </div>
                </div>
              )}

              <div className={cVat}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                  IVA
                </span>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    max="100"
                    list="common-vat-rates"
                    value={it.vat_rate}
                    onChange={(e) => update(i, { vat_rate: Number(e.target.value) || 0 })}
                    disabled={locked}
                    className="pr-8 text-right tabular-nums"
                    aria-label={`IVA línea ${i + 1}`}
                  />
                  <span
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                    aria-hidden="true"
                  >
                    %
                  </span>
                </div>
              </div>

              <div className={`flex flex-col md:items-end ${cAmount}`}>
                <span
                  className={`mb-1 text-xs font-medium text-muted-foreground md:hidden ${n('min-[480px]:hidden')}`}
                >
                  Importe
                </span>
                <span className="flex h-9 items-center gap-2 font-semibold tabular-nums">
                  {showDiscounts && normalizeDiscountPercent(it.discount_percent) > 0 && (
                    <span className="text-xs font-normal text-muted-foreground line-through">
                      {formatEUR(computeLineSubtotal(it))}
                    </span>
                  )}
                  {formatEUR(showDiscounts ? lineNet(it) : computeLineSubtotal(it))}
                </span>
              </div>

              <div className={`col-span-2 flex justify-end gap-1 md:col-span-1 ${cActions}`}>
                <button
                  type="button"
                  onClick={() => duplicate(i)}
                  disabled={locked}
                  aria-label={`Duplicar línea ${i + 1}`}
                  className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <Copy className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={locked || items.length === 1}
                  aria-label={`Eliminar línea ${i + 1}`}
                  className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>

              {showDiscounts && normalizeDiscountPercent(it.discount_percent) > 0 && (
                <div className={`col-span-2 md:col-span-full ${cReason}`}>
                  <Input
                    value={it.discount_reason ?? ''}
                    onChange={(e) => update(i, { discount_reason: e.target.value || null })}
                    disabled={locked}
                    maxLength={200}
                    placeholder="Motivo del descuento (opcional)"
                    aria-label={`Motivo del descuento línea ${i + 1}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      <datalist id="common-vat-rates">
        <option value="0" />
        <option value="4" />
        <option value="10" />
        <option value="21" />
      </datalist>

      <div className="flex flex-col gap-5 border-t border-border bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={add}
          disabled={locked}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 text-sm font-medium text-primary hover:border-primary/50 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50 sm:justify-start"
        >
          <Plus className="size-4" aria-hidden="true" /> Añadir concepto
        </button>

        <dl className="flex w-full flex-col gap-2 text-sm sm:max-w-xs">
          {showDiscounts &&
            (bucketed.discounts.lineDiscount > 0 || bucketed.discounts.globalDiscount > 0) && (
              <>
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <dt>Importe bruto</dt>
                  <dd className="tabular-nums">{formatEUR(bucketed.discounts.gross)}</dd>
                </div>
                {bucketed.discounts.lineDiscount > 0 && (
                  <div className="flex justify-between gap-4 text-emerald-600">
                    <dt>Descuentos en partidas</dt>
                    <dd className="tabular-nums">−{formatEUR(bucketed.discounts.lineDiscount)}</dd>
                  </div>
                )}
                {bucketed.discounts.globalDiscount > 0 && (
                  <div className="flex justify-between gap-4 text-emerald-600">
                    <dt>Descuento global</dt>
                    <dd className="tabular-nums">
                      −{formatEUR(bucketed.discounts.globalDiscount)}
                    </dd>
                  </div>
                )}
              </>
            )}
          {showBillingCycle && recurringRows.length > 0 ? (
            <>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>Inversión inicial</dt>
                <dd className="tabular-nums">{formatEUR(bucketed.oneTime.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-medium">
                <dt>Total único (IVA incl.)</dt>
                <dd className="tabular-nums">{formatEUR(bucketed.oneTime.total)}</dd>
              </div>
              {recurringRows.map((cycle) => (
                <div key={cycle} className="flex justify-between gap-4 text-muted-foreground">
                  <dt>{BILLING_CYCLE_LABELS[cycle]} (IVA incl.)</dt>
                  <dd className="tabular-nums">{formatEUR(bucketed[cycle].total)}</dd>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>Base imponible</dt>
                <dd className="tabular-nums">{formatEUR(flat.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>IVA</dt>
                <dd className="tabular-nums">{formatEUR(flat.taxAmount)}</dd>
              </div>
              <div className="mt-1 flex items-center justify-between gap-4 rounded-lg bg-background px-4 py-3 font-semibold shadow-sm ring-1 ring-foreground/10">
                <dt>Total</dt>
                <dd className="text-lg tabular-nums">{formatEUR(flat.total)}</dd>
              </div>
            </>
          )}
          {showDiscounts && onDiscountChange && discount && (
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <span className="text-xs font-medium text-muted-foreground">
                Descuento global (solo pagos únicos)
              </span>
              <div className="flex gap-2">
                <Select
                  value={discount.type}
                  onChange={(e) =>
                    onDiscountChange({
                      ...discount,
                      type: e.target.value as DiscountType,
                      value: e.target.value === 'none' ? 0 : discount.value,
                    })
                  }
                  disabled={locked}
                  aria-label="Tipo de descuento global"
                >
                  <option value="none">Sin descuento</option>
                  <option value="percent">Porcentaje (%)</option>
                  <option value="amount">Importe (€)</option>
                </Select>
                {discount.type !== 'none' && (
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max={discount.type === 'percent' ? 100 : undefined}
                    value={discount.value || ''}
                    onChange={(e) =>
                      onDiscountChange({ ...discount, value: Number(e.target.value) || 0 })
                    }
                    disabled={locked}
                    className="text-right tabular-nums"
                    aria-label="Valor del descuento global"
                  />
                )}
              </div>
              {discount.type !== 'none' && (
                <Input
                  value={discount.reason}
                  onChange={(e) => onDiscountChange({ ...discount, reason: e.target.value })}
                  disabled={locked}
                  maxLength={200}
                  placeholder="Motivo del descuento (opcional)"
                  aria-label="Motivo del descuento global"
                />
              )}
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
