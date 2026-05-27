"use client";

import { LineItemsTable } from "@/components/finance/line-items-table";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_LINE_ITEM, type LineItem } from "@/lib/finance";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { useMemo, useState } from "react";
import { updateProposal } from "../actions";

export type EditableItem = LineItem;

export type ProposalEditorProps = {
  id: string;
  initialTitle: string;
  initialValidUntil: string | null;
  initialNotes: string | null;
  initialIntro: string | null;
  initialTerms: string | null;
  initialItems: EditableItem[];
  /** When true, fields are read-only (proposal accepted/rejected). */
  locked: boolean;
};

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
  initialIntro,
  initialTerms,
  initialItems,
  locked,
}: ProposalEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [validUntil, setValidUntil] = useState(initialValidUntil ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [intro, setIntro] = useState(initialIntro ?? "");
  const [terms, setTerms] = useState(initialTerms ?? "");
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.length > 0 ? initialItems : [{ ...EMPTY_LINE_ITEM }],
  );

  const payload = useMemo(
    () => ({
      id,
      title,
      valid_until: validUntil || null,
      notes: notes || null,
      intro: intro || null,
      terms: terms || null,
      items,
    }),
    [id, title, validUntil, notes, intro, terms, items],
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
        <div className="overflow-hidden rounded-lg border border-border">
          <LineItemsTable items={items} onChange={setItems} locked={locked} />
        </div>

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

      {/* Markdown blocks rendered above/below the items in the portal & email */}
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium">
          Introducción
          <span className="font-normal text-muted-foreground">
            Markdown que se muestra <em>antes</em> de la tabla de líneas en el portal del cliente.
          </span>
          <Textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            disabled={locked}
            rows={6}
            className="font-mono text-xs"
            placeholder={"## Contexto\n\nBreve resumen del proyecto, objetivos y enfoque."}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium">
          Condiciones
          <span className="font-normal text-muted-foreground">
            Markdown que se muestra <em>después</em> del total. Forma de pago, validez, etc.
          </span>
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            disabled={locked}
            rows={6}
            className="font-mono text-xs"
            placeholder={
              "## Condiciones\n\n- 50% al inicio, 50% a la entrega.\n- Vigencia: 30 días."
            }
          />
        </label>
      </div>
    </div>
  );
}
