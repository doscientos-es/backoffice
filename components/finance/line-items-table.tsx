"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  type BillingCycle,
  EMPTY_LINE_ITEM,
  type LineItem,
  computeLineSubtotal,
  computeLineTotals,
  computeProposalTotals,
} from "@/lib/finance";
import { formatEUR } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export type LineItemsTableProps = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  /** When true, every input is disabled. Used by invoice/proposal edit views. */
  locked?: boolean;
  /**
   * When true, renders the cadence selector per line and a bucketed totals
   * footer (one-time + recurring). Used by proposals; invoices keep the
   * one-shot layout.
   */
  showBillingCycle?: boolean;
};

const RECURRING_CYCLES: ReadonlyArray<Exclude<BillingCycle, "none">> = [
  "monthly",
  "quarterly",
  "yearly",
];

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
}: LineItemsTableProps) {
  const flat = computeLineTotals(items);
  const bucketed = computeProposalTotals(items);
  const recurringRows = showBillingCycle
    ? RECURRING_CYCLES.filter((c) => bucketed[c].total > 0)
    : [];
  const totalsColSpan = showBillingCycle ? 5 : 4;
  const footerColSpan = showBillingCycle ? 6 : 5;

  const update = (i: number, patch: Partial<LineItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, { ...EMPTY_LINE_ITEM, id: crypto.randomUUID() }]);
  const remove = (i: number) =>
    onChange(items.length === 1 ? items : items.filter((_, idx) => idx !== i));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Descripción</th>
            {showBillingCycle && (
              <th className="w-32 px-2 py-2 font-medium">Cadencia</th>
            )}
            <th className="w-20 px-2 py-2 font-medium text-right">Cant.</th>
            <th className="w-28 px-2 py-2 font-medium text-right">Precio</th>
            <th className="w-20 px-2 py-2 font-medium text-right">IVA %</th>
            <th className="w-28 px-2 py-2 font-medium text-right">Subtotal</th>
            <th className="w-9 px-1 py-2" aria-label="acciones"/>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} className="border-t border-border">
              <td className="px-2 py-1.5">
                <Input
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  disabled={locked}
                  placeholder="Descripción"
                  maxLength={500}
                  aria-label={`Descripción línea ${i + 1}`}
                />
              </td>
              {showBillingCycle && (
                <td className="px-1 py-1.5">
                  <Select
                    value={it.billing_cycle ?? "none"}
                    onChange={(e) =>
                      update(i, { billing_cycle: e.target.value as BillingCycle })
                    }
                    disabled={locked}
                    aria-label={`Cadencia línea ${i + 1}`}
                  >
                    {BILLING_CYCLES.map((c) => (
                      <option key={c} value={c}>
                        {BILLING_CYCLE_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </td>
              )}
              <td className="px-1 py-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={it.quantity}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
                  disabled={locked}
                  className="text-right tabular-nums"
                  aria-label={`Cantidad línea ${i + 1}`}
                />
              </td>
              <td className="px-1 py-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={it.unit_price}
                  onChange={(e) => update(i, { unit_price: Number(e.target.value) || 0 })}
                  disabled={locked}
                  className="text-right tabular-nums"
                  aria-label={`Precio línea ${i + 1}`}
                />
              </td>
              <td className="px-1 py-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  max="100"
                  value={it.vat_rate}
                  onChange={(e) => update(i, { vat_rate: Number(e.target.value) || 0 })}
                  disabled={locked}
                  className="text-right tabular-nums"
                  aria-label={`IVA línea ${i + 1}`}
                />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatEUR(computeLineSubtotal(it))}
              </td>
              <td className="px-1 py-1.5 text-right">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={locked || items.length === 1}
                  aria-label={`Eliminar línea ${i + 1}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border">
          <tr>
            <td colSpan={footerColSpan - 1} className="px-3 py-2">
              <button
                type="button"
                onClick={add}
                disabled={locked}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-3.5" aria-hidden /> Añadir línea
              </button>
            </td>
            <td className="px-1 py-2" />
          </tr>
          {showBillingCycle && recurringRows.length > 0 ? (
            <>
              <tr>
                <td
                  colSpan={totalsColSpan}
                  className="px-3 py-1.5 text-right text-xs text-muted-foreground"
                >
                  Inversión inicial (único)
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatEUR(bucketed.oneTime.subtotal)}
                </td>
                <td />
              </tr>
              <tr className="font-medium">
                <td colSpan={totalsColSpan} className="px-3 py-1.5 text-right text-xs">
                  Total único (IVA incl.)
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatEUR(bucketed.oneTime.total)}
                </td>
                <td />
              </tr>
              {recurringRows.map((cycle) => (
                <tr key={cycle}>
                  <td
                    colSpan={totalsColSpan}
                    className="px-3 py-1.5 text-right text-xs text-muted-foreground"
                  >
                    {BILLING_CYCLE_LABELS[cycle]} (IVA incl.)
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatEUR(bucketed[cycle].total)}
                  </td>
                  <td />
                </tr>
              ))}
            </>
          ) : (
            <>
              <tr>
                <td
                  colSpan={totalsColSpan}
                  className="px-3 py-1.5 text-right text-xs text-muted-foreground"
                >
                  Subtotal
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatEUR(flat.subtotal)}
                </td>
                <td />
              </tr>
              <tr>
                <td
                  colSpan={totalsColSpan}
                  className="px-3 py-1.5 text-right text-xs text-muted-foreground"
                >
                  IVA
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatEUR(flat.taxAmount)}
                </td>
                <td />
              </tr>
              <tr className="font-semibold">
                <td colSpan={totalsColSpan} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatEUR(flat.total)}</td>
                <td />
              </tr>
            </>
          )}
        </tfoot>
      </table>
    </div>
  );
}
