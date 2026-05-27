"use client";

import { Input } from "@/components/ui/input";
import {
  EMPTY_LINE_ITEM,
  type LineItem,
  computeLineSubtotal,
  computeLineTotals,
} from "@/lib/finance";
import { formatEUR } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export type LineItemsTableProps = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  /** When true, every input is disabled. Used by invoice/proposal edit views. */
  locked?: boolean;
};

/**
 * Editable line-items table shared by invoice and proposal editors. Owns the
 * desglose UI (Subtotal / IVA / Total) so callers only deal with the items
 * array; totals are derived via `computeLineTotals`.
 */
export function LineItemsTable({ items, onChange, locked = false }: LineItemsTableProps) {
  const { subtotal, taxAmount, total } = computeLineTotals(items);

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
            <th className="w-20 px-2 py-2 font-medium text-right">Cant.</th>
            <th className="w-28 px-2 py-2 font-medium text-right">Precio</th>
            <th className="w-20 px-2 py-2 font-medium text-right">IVA %</th>
            <th className="w-28 px-2 py-2 font-medium text-right">Subtotal</th>
            <th className="w-9 px-1 py-2" aria-label="acciones" />
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
            <td colSpan={5} className="px-3 py-2">
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
          <tr>
            <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-muted-foreground">
              Subtotal
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatEUR(subtotal)}</td>
            <td />
          </tr>
          <tr>
            <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-muted-foreground">
              IVA
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatEUR(taxAmount)}</td>
            <td />
          </tr>
          <tr className="font-semibold">
            <td colSpan={4} className="px-3 py-2 text-right">
              Total
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{formatEUR(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
