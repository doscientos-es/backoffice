"use client";

import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { formatEUR } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { updateProposal } from "../actions";

export type EditableItem = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

export type ProposalEditorProps = {
  id: string;
  initialTitle: string;
  initialValidUntil: string | null;
  initialNotes: string | null;
  initialItems: EditableItem[];
  /** When true, fields are read-only (proposal accepted/rejected). */
  locked: boolean;
};

const EMPTY: EditableItem = { description: "", quantity: 1, unit_price: 0, vat_rate: 21 };

function n2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Inline editor for the proposal detail page. Every field autosaves with a
 * 2 s debounce via `updateProposal` server action so two team members can
 * collaborate without explicit save buttons.
 */
export function ProposalEditor({
  id,
  initialTitle,
  initialValidUntil,
  initialNotes,
  initialItems,
  locked,
}: ProposalEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [validUntil, setValidUntil] = useState(initialValidUntil ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.length > 0 ? initialItems : [{ ...EMPTY }],
  );

  const payload = useMemo(
    () => ({ id, title, valid_until: validUntil || null, notes: notes || null, items }),
    [id, title, validUntil, notes, items],
  );

  const autosave = useAutosave({
    data: payload,
    enabled: !locked,
    storageKey: `proposal-edit:${id}`,
    onSave: async (data) => {
      const res = await updateProposal(data);
      if (!res.ok) return { error: res.error };
    },
  });

  const { subtotal, taxAmount, total } = useMemo(() => {
    let s = 0;
    let t = 0;
    for (const it of items) {
      const line = it.quantity * it.unit_price;
      s += line;
      t += line * (it.vat_rate / 100);
    }
    s = n2(s);
    t = n2(t);
    return { subtotal: s, taxAmount: t, total: n2(s + t) };
  }, [items]);

  const updateItem = (i: number, patch: Partial<EditableItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY }]);
  const removeItem = (i: number) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={locked}
          placeholder="Título de la propuesta"
          className="flex-1 min-w-0 h-9 text-base font-medium"
          aria-label="Título"
        />
        <AutosaveIndicator
          status={autosave.status}
          savedAt={autosave.savedAt}
          error={autosave.error}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ItemsTable
          items={items}
          locked={locked}
          onUpdate={updateItem}
          onAdd={addItem}
          onRemove={removeItem}
          subtotal={subtotal}
          taxAmount={taxAmount}
          total={total}
        />

        <aside className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Válida hasta
            <Input
              type="date"
              value={validUntil ?? ""}
              onChange={(e) => setValidUntil(e.target.value)}
              disabled={locked}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Notas
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={locked}
              rows={6}
              placeholder="Notas internas o para el cliente…"
            />
          </label>
        </aside>
      </div>
    </div>
  );
}

type ItemsTableProps = {
  items: EditableItem[];
  locked: boolean;
  onUpdate: (i: number, patch: Partial<EditableItem>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  subtotal: number;
  taxAmount: number;
  total: number;
};

function ItemsTable({
  items,
  locked,
  onUpdate,
  onAdd,
  onRemove,
  subtotal,
  taxAmount,
  total,
}: ItemsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
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
          {items.map((it, i) => {
            const lineSubtotal = n2(it.quantity * it.unit_price);
            return (
              <tr key={i} className="border-t border-border">
                <td className="px-2 py-1.5">
                  <Input
                    value={it.description}
                    onChange={(e) => onUpdate(i, { description: e.target.value })}
                    disabled={locked}
                    placeholder="Descripción"
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
                    onChange={(e) => onUpdate(i, { quantity: Number(e.target.value) || 0 })}
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
                    onChange={(e) => onUpdate(i, { unit_price: Number(e.target.value) || 0 })}
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
                    onChange={(e) => onUpdate(i, { vat_rate: Number(e.target.value) || 0 })}
                    disabled={locked}
                    className="text-right tabular-nums"
                    aria-label={`IVA línea ${i + 1}`}
                  />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatEUR(lineSubtotal)}</td>
                <td className="px-1 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    disabled={locked || items.length === 1}
                    aria-label={`Eliminar línea ${i + 1}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-border">
          <tr>
            <td colSpan={5} className="px-3 py-2">
              <button
                type="button"
                onClick={onAdd}
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
