"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

const EMPTY: LineItem = { description: "", quantity: 1, unit_price: 0, vat_rate: 21 };

function n2(x: number): number {
  return Math.round(x * 100) / 100;
}

export type LineItemsEditorProps = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
};

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  const update = (i: number, patch: Partial<LineItem>) => {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const add = () => onChange([...items, { ...EMPTY }]);
  const remove = (i: number) =>
    onChange(items.length === 1 ? items : items.filter((_, idx) => idx !== i));

  let subtotal = 0;
  let taxAmount = 0;
  for (const it of items) {
    const sub = it.quantity * it.unit_price;
    subtotal += sub;
    taxAmount += sub * (it.vat_rate / 100);
  }
  subtotal = n2(subtotal);
  taxAmount = n2(taxAmount);
  const total = n2(subtotal + taxAmount);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">Descripción</th>
              <th className="pb-2 pl-2 font-medium text-right w-24">Cant.</th>
              <th className="pb-2 pl-2 font-medium text-right w-28">Precio</th>
              <th className="pb-2 pl-2 font-medium text-right w-20">IVA %</th>
              <th className="pb-2 pl-2 font-medium text-right w-28">Subtotal</th>
              <th className="pb-2 pl-2 w-9" aria-label="acciones" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const sub = n2(it.quantity * it.unit_price);
              return (
                <tr key={i} className="align-top">
                  <td className="py-1">
                    <Input
                      value={it.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      placeholder="Concepto"
                      required
                      maxLength={500}
                    />
                  </td>
                  <td className="py-1 pl-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right tabular-nums"
                      value={it.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-1 pl-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right tabular-nums"
                      value={it.unit_price}
                      onChange={(e) => update(i, { unit_price: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-1 pl-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="text-right tabular-nums"
                      value={it.vat_rate}
                      onChange={(e) => update(i, { vat_rate: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-1 pl-2 pt-2.5 text-right tabular-nums">{formatEUR(sub)}</td>
                  <td className="py-1 pl-2 pt-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(i)}
                      disabled={items.length === 1}
                      aria-label="Eliminar línea"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right text-xs text-muted-foreground">
                Subtotal
              </td>
              <td className="pt-3 pl-2 text-right tabular-nums">{formatEUR(subtotal)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={4} className="pt-1 text-right text-xs text-muted-foreground">
                IVA
              </td>
              <td className="pt-1 pl-2 text-right tabular-nums">{formatEUR(taxAmount)}</td>
              <td />
            </tr>
            <tr className="font-semibold">
              <td colSpan={4} className="pt-1 text-right">
                Total
              </td>
              <td className="pt-1 pl-2 text-right tabular-nums">{formatEUR(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-3.5" />
          Añadir línea
        </Button>
      </div>
    </div>
  );
}
