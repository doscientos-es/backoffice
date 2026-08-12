"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyScopeModule,
  SCOPE_MODULE_LIMITS,
  type ScopeModule,
} from "@/lib/proposals/scope";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  modules: ScopeModule[];
  onChange: (modules: ScopeModule[]) => void;
  locked?: boolean;
};

function compactBullets(values: string[]): string[] {
  return values
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
}

function sameBullets(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((bullet, index) => bullet === right[index]);
}

function ScopeBulletEditor({
  label,
  items,
  onChange,
  disabled,
  moduleIndex,
  tone,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  disabled: boolean;
  moduleIndex: number;
  tone: "included" | "excluded";
}) {
  const [drafts, setDrafts] = useState<string[]>(() => (items.length > 0 ? items : [""]));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusIndex = useRef<number | null>(null);
  const hintId = `scope-${tone}-${moduleIndex}-hint`;
  const filledCount = compactBullets(drafts).length;
  const hasBlankDraft = drafts.some((draft) => !draft.trim());
  const atLimit = drafts.length >= SCOPE_MODULE_LIMITS.maxBulletCount;

  useEffect(() => {
    if (!sameBullets(compactBullets(drafts), items)) {
      setDrafts(items.length > 0 ? items : [""]);
    }
  }, [drafts, items]);

  useEffect(() => {
    if (focusIndex.current === null) return;
    inputRefs.current[focusIndex.current]?.focus();
    focusIndex.current = null;
  }, [drafts.length]);

  const updateDraft = (index: number, value: string) => {
    const next = drafts.map((draft, current) => (current === index ? value : draft));
    setDrafts(next);
    onChange(compactBullets(next));
  };

  const removeDraft = (index: number, nextFocusIndex = Math.max(0, index - 1)) => {
    const next = drafts.filter((_, current) => current !== index);
    const nextDrafts = next.length > 0 ? next : [""];
    focusIndex.current = Math.min(nextFocusIndex, nextDrafts.length - 1);
    setDrafts(nextDrafts);
    onChange(compactBullets(nextDrafts));
  };

  const addDraft = (afterIndex = drafts.length - 1) => {
    const blankIndex = drafts.findIndex((draft) => !draft.trim());
    if (blankIndex >= 0) {
      inputRefs.current[blankIndex]?.focus();
      return;
    }
    if (atLimit) return;
    const next = [...drafts.slice(0, afterIndex + 1), "", ...drafts.slice(afterIndex + 1)];
    focusIndex.current = afterIndex + 1;
    setDrafts(next);
  };

  const accentClass =
    tone === "included"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "bg-muted text-muted-foreground";

  return (
    <section aria-labelledby={`scope-${tone}-${moduleIndex}-label`} className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 id={`scope-${tone}-${moduleIndex}-label`} className="text-sm font-medium">
            {label}
          </h3>
          <p id={hintId} className="mt-0.5 text-[11px] text-muted-foreground">
            Un punto por fila. Pulsa Intro para crear el siguiente.
          </p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {filledCount}/{SCOPE_MODULE_LIMITS.maxBulletCount}
        </span>
      </div>
      <ol aria-label={`${label} en módulo ${moduleIndex + 1}`} className="flex flex-col gap-1.5">
        {drafts.map((draft, bulletIndex) => (
          <li key={bulletIndex} className="flex items-center gap-2">
            <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${accentClass}`}>
              •
            </span>
            <Input
              ref={(element) => {
                inputRefs.current[bulletIndex] = element;
              }}
              value={draft}
              onChange={(event) => updateDraft(bulletIndex, event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter" && draft.trim()) {
                  event.preventDefault();
                  addDraft(bulletIndex);
                }
                if (event.key === "Backspace" && !draft && bulletIndex > 0) {
                  event.preventDefault();
                  removeDraft(bulletIndex);
                }
              }}
              disabled={disabled}
              maxLength={SCOPE_MODULE_LIMITS.maxBulletLength}
              placeholder={bulletIndex === 0 ? "Escribe un punto" : "Siguiente punto"}
              aria-label={`${label}, punto ${bulletIndex + 1}`}
              aria-describedby={hintId}
              className="h-9 bg-background"
            />
            <button
              type="button"
              onClick={() => removeDraft(bulletIndex)}
              disabled={disabled || (drafts.length === 1 && !draft)}
              aria-label={`Eliminar punto ${bulletIndex + 1} de ${label}`}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => addDraft()}
        disabled={disabled || (atLimit && !hasBlankDraft)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden /> Añadir punto
      </button>
    </section>
  );
}

/** Structured editor so scope can drive both client documents and later delivery prompts. */
export function ScopeModulesEditor({ modules, onChange, locked = false }: Props) {
  const disabled = locked;
  const update = (index: number, patch: Partial<ScopeModule>) =>
    onChange(
      modules.map((module, current) => (current === index ? { ...module, ...patch } : module)),
    );
  const remove = (index: number) => onChange(modules.filter((_, current) => current !== index));
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= modules.length) return;
    const next = modules.slice();
    const current = next[index];
    const target = next[destination];
    if (!current || !target) return;
    next[index] = target;
    next[destination] = current;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {modules.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          Define cada módulo para dejar claro qué entra —y qué no— antes de aceptar la propuesta.
        </div>
      ) : null}
      <ol aria-label="Módulos incluidos" className="flex flex-col gap-3">
        {modules.map((module, index) => (
          <li key={module.id} className="rounded-md border border-border bg-background p-3">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Módulo
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={disabled || index === 0}
                aria-label={`Subir módulo ${index + 1}`}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={disabled || index === modules.length - 1}
                aria-label={`Bajar módulo ${index + 1}`}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={disabled}
                aria-label={`Eliminar módulo ${index + 1}`}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <Input
                  value={module.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                  disabled={disabled}
                  maxLength={SCOPE_MODULE_LIMITS.maxTitleLength}
                  placeholder="Nombre del módulo"
                  aria-label={`Nombre del módulo ${index + 1}`}
                  className="h-8 text-sm font-medium"
                />
                <Textarea
                  value={module.description ?? ""}
                  onChange={(event) => update(index, { description: event.target.value })}
                  disabled={disabled}
                  maxLength={SCOPE_MODULE_LIMITS.maxDescriptionLength}
                  rows={3}
                  placeholder="Descripción: qué resuelve y para quién"
                  aria-label={`Descripción del módulo ${index + 1}`}
                  className="resize-y text-sm"
                />
                <Textarea
                  value={module.notes ?? ""}
                  onChange={(event) => update(index, { notes: event.target.value })}
                  disabled={disabled}
                  maxLength={SCOPE_MODULE_LIMITS.maxNotesLength}
                  rows={2}
                  placeholder="Notas o dependencias del módulo"
                  aria-label={`Notas del módulo ${index + 1}`}
                  className="resize-y text-sm"
                />
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <ScopeBulletEditor
                  label="Incluido"
                  items={module.included}
                  onChange={(included) => update(index, { included })}
                  disabled={disabled}
                  moduleIndex={index}
                  tone="included"
                />
                <ScopeBulletEditor
                  label="No incluido"
                  items={module.excluded}
                  onChange={(excluded) => update(index, { excluded })}
                  disabled={disabled}
                  moduleIndex={index}
                  tone="excluded"
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onChange([...modules, createEmptyScopeModule()])}
        disabled={disabled || modules.length >= SCOPE_MODULE_LIMITS.maxCount}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden /> Añadir módulo
      </button>
    </div>
  );
}
