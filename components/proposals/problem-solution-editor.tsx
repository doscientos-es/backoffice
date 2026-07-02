"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type EditablePair,
  KEY_POINTS_LIMITS,
  createEmptyPair,
} from "@/lib/proposals/key-points";
import { ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from "lucide-react";

export type ProblemSolutionEditorProps = {
  items: EditablePair[];
  onChange: (items: EditablePair[]) => void;
  /** When true, every input is disabled. Mirrors `KeyPointsEditor.locked`. */
  locked?: boolean;
  /** Shows the "generate with AI" affordance while the list is empty. */
  aiEnabled?: boolean;
  /** Invoked by the AI button. The parent owns the request and state update. */
  onGenerate?: () => void;
  /** Disables inputs and shows a pending label while a generation is running. */
  generating?: boolean;
};

/**
 * Paired problem↔solution editor. Each row keeps a problem (title + description)
 * next to the solution we propose for it, so the narrative always reads as a
 * matched set. Owns add/remove/reorder; the parent only deals with the array
 * via `onChange` and wires the optional AI generation.
 */
export function ProblemSolutionEditor({
  items,
  onChange,
  locked = false,
  aiEnabled = false,
  onGenerate,
  generating = false,
}: ProblemSolutionEditorProps) {
  const max = KEY_POINTS_LIMITS.maxCount;
  const disabled = locked || generating;

  const update = (i: number, patch: Partial<EditablePair>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const add = () => {
    if (items.length >= max) return;
    onChange([...items, createEmptyPair()]);
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = items.slice();
    const a = copy[i];
    const b = copy[j];
    if (!a || !b) return;
    copy[i] = b;
    copy[j] = a;
    onChange(copy);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border px-3 py-4">
        <p className="text-xs text-muted-foreground">
          Aún no hay problemas ni soluciones. Añade el primero o deja que la IA los proponga.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={add}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden /> Añadir par
          </button>
          {aiEnabled && onGenerate ? (
            <button
              type="button"
              onClick={onGenerate}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <Sparkles className="size-3.5" aria-hidden />
              {generating ? "Generando…" : "Generar 3 con IA"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Pares de problema y solución" className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li
            key={it.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Problema → Solución
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={disabled || i === 0}
                  aria-label={`Subir par ${i + 1}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={disabled || i === items.length - 1}
                  aria-label={`Bajar par ${i + 1}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  aria-label={`Eliminar par ${i + 1}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Input
                  value={it.problem}
                  onChange={(e) => update(i, { problem: e.target.value })}
                  disabled={disabled}
                  placeholder="Problema detectado"
                  maxLength={KEY_POINTS_LIMITS.maxTitleLength}
                  aria-label={`Problema ${i + 1}`}
                  className="h-8 text-sm font-medium"
                />
                <Textarea
                  value={it.problemDescription}
                  onChange={(e) => update(i, { problemDescription: e.target.value })}
                  disabled={disabled}
                  placeholder="Descripción (opcional)"
                  maxLength={KEY_POINTS_LIMITS.maxDescriptionLength}
                  rows={2}
                  aria-label={`Descripción del problema ${i + 1}`}
                  className="resize-y text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Input
                  value={it.solution}
                  onChange={(e) => update(i, { solution: e.target.value })}
                  disabled={disabled}
                  placeholder="Cómo lo abordamos"
                  maxLength={KEY_POINTS_LIMITS.maxTitleLength}
                  aria-label={`Solución ${i + 1}`}
                  className="h-8 text-sm font-medium"
                />
                <Textarea
                  value={it.solutionDescription}
                  onChange={(e) => update(i, { solutionDescription: e.target.value })}
                  disabled={disabled}
                  placeholder="Descripción (opcional)"
                  maxLength={KEY_POINTS_LIMITS.maxDescriptionLength}
                  rows={2}
                  aria-label={`Descripción de la solución ${i + 1}`}
                  className="resize-y text-sm"
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={add}
        disabled={disabled || items.length >= max}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden /> Añadir par
      </button>
      {items.length >= max ? (
        <p className="text-[11px] text-muted-foreground">Máximo {max} pares.</p>
      ) : null}
    </div>
  );
}
