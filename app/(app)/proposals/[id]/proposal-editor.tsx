"use client";

import { LineItemsTable } from "@/components/finance/line-items-table";
import { KeyPointsEditor } from "@/components/proposals/key-points-editor";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_LINE_ITEM, type LineItem } from "@/lib/finance";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { type EditableKeyPoint, serializeKeyPoints } from "@/lib/proposals/key-points";
import { useMemo, useState } from "react";
import { updateProposal } from "../actions";

export type EditableItem = LineItem;

export type ProposalEditorProps = {
  id: string;
  initialTitle: string;
  initialValidUntil: string | null;
  initialNotes: string | null;
  initialContextMarkdown: string | null;
  initialProblems: EditableKeyPoint[];
  initialSolutions: EditableKeyPoint[];
  initialTerms: string | null;
  initialItems: EditableItem[];
  /** When true, fields are read-only (proposal accepted/rejected). */
  locked: boolean;
};

/**
 * Inline editor for the proposal detail page. Every field autosaves with a
 * 2 s debounce via `updateProposal` server action so two team members can
 * collaborate without explicit save buttons.
 *
 * Narrative is split into three blocks (context / problems / solutions) that
 * map 1-to-1 to deck slides and portal sections; see
 * `lib/proposals/key-points.ts` for the wire shape.
 */
export function ProposalEditor({
  id,
  initialTitle,
  initialValidUntil,
  initialNotes,
  initialContextMarkdown,
  initialProblems,
  initialSolutions,
  initialTerms,
  initialItems,
  locked,
}: ProposalEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [validUntil, setValidUntil] = useState(initialValidUntil ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [notesPreview, setNotesPreview] = useState(false);
  const [contextMarkdown, setContextMarkdown] = useState(initialContextMarkdown ?? "");
  const [problems, setProblems] = useState<EditableKeyPoint[]>(initialProblems);
  const [solutions, setSolutions] = useState<EditableKeyPoint[]>(initialSolutions);
  const [terms, setTerms] = useState(initialTerms ?? "");
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.length > 0
      ? initialItems.map((it) => ({ ...it, id: it.id || crypto.randomUUID() }))
      : [{ ...EMPTY_LINE_ITEM, id: crypto.randomUUID() } as EditableItem],
  );

  const payload = useMemo(
    () => ({
      id,
      title,
      valid_until: validUntil || null,
      notes: notes || null,
      context_markdown: contextMarkdown || null,
      problems: serializeKeyPoints(problems),
      solutions: serializeKeyPoints(solutions),
      terms: terms || null,
      items,
    }),
    [id, title, validUntil, notes, contextMarkdown, problems, solutions, terms, items],
  );

  const autosave = useAutosave({
    data: payload,
    enabled: !locked,
    storageKey: `proposal-edit:${id}`,
    onSaveAction: async (data) => {
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
        {!locked && (
          <Button
            size="sm"
            variant="outline"
            onClick={autosave.saveNow}
            disabled={autosave.status === "saving"}
          >
            Guardar
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-border">
          <LineItemsTable items={items} onChange={setItems} locked={locked} showBillingCycle />
        </div>

        <aside className="flex flex-col gap-3">
          <FormRow label="Válida hasta" htmlFor="valid-until">
            <Input
              id="valid-until"
              type="date"
              value={validUntil ?? ""}
              onChange={(e) => setValidUntil(e.target.value)}
              disabled={locked}
            />
          </FormRow>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Notas</span>
              {notes && (
                <button
                  type="button"
                  onClick={() => setNotesPreview((p) => !p)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {notesPreview ? "Editar" : "Previsualizar"}
                </button>
              )}
            </div>
            {notesPreview && notes ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 min-h-36">
                <Markdown source={notes} />
              </div>
            ) : (
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={locked}
                rows={6}
                placeholder="Notas internas o para el cliente… (soporta Markdown)"
              />
            )}
          </div>
        </aside>
      </div>

      {/* Narrative blocks — shown before the price on every client surface */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Narrativa de la propuesta</h2>
          <p className="text-[11px] text-muted-foreground">
            Contexto, problemas detectados y enfoque de la solución. Se muestran al cliente antes
            del precio en el portal y como diapositivas en la presentación.
          </p>
        </header>

        <FormRow
          label="Contexto"
          htmlFor="context-markdown"
          hint="Markdown. Sitúa la situación actual del cliente en 2-3 frases."
        >
          <Textarea
            id="context-markdown"
            value={contextMarkdown}
            onChange={(e) => setContextMarkdown(e.target.value)}
            disabled={locked}
            rows={4}
            className="font-mono text-xs"
            placeholder={"Tras nuestras conversaciones, hemos detectado que…"}
          />
        </FormRow>

        <FormRow
          label="Problemas detectados"
          htmlFor="problems"
          hint="Lo que el cliente nos ha contado. Una tarjeta por reto."
        >
          <KeyPointsEditor
            items={problems}
            onChange={setProblems}
            locked={locked}
            ariaLabel="Lista de problemas"
            titlePlaceholder="Problema detectado"
            descriptionPlaceholder="Descripción (opcional)"
            addLabel="Añadir problema"
          />
        </FormRow>

        <FormRow
          label="Cómo lo abordamos"
          htmlFor="solutions"
          hint="Cómo planteamos resolverlo. Una tarjeta por iniciativa."
        >
          <KeyPointsEditor
            items={solutions}
            onChange={setSolutions}
            locked={locked}
            ariaLabel="Lista de soluciones"
            titlePlaceholder="Iniciativa o enfoque"
            descriptionPlaceholder="Descripción (opcional)"
            addLabel="Añadir solución"
          />
        </FormRow>
      </section>

      <FormRow
        label="Condiciones"
        htmlFor="terms"
        hint="Markdown que se muestra después del total. Forma de pago, validez, etc."
      >
        <Textarea
          id="terms"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          disabled={locked}
          rows={6}
          className="font-mono text-xs"
          placeholder={"## Condiciones\n\n- 50% al inicio, 50% a la entrega.\n- Vigencia: 30 días."}
        />
      </FormRow>
    </div>
  );
}
