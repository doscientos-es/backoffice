"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyScopeModule,
  SCOPE_MODULE_LIMITS,
  type ScopeModule,
} from "@/lib/proposals/scope";

type Props = {
  modules: ScopeModule[];
  onChange: (modules: ScopeModule[]) => void;
  locked?: boolean;
};

function linesToBullets(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
}

function bulletsToLines(value: string[]): string {
  return value.join("\n");
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Textarea
                  value={bulletsToLines(module.included)}
                  onChange={(event) =>
                    update(index, { included: linesToBullets(event.target.value) })
                  }
                  disabled={disabled}
                  rows={7}
                  placeholder={
                    "Incluido (un punto por línea)\nEj.: Alta de usuarios\nEj.: Gestión de permisos"
                  }
                  aria-label={`Incluido en módulo ${index + 1}`}
                  className="resize-y text-sm"
                />
                <Textarea
                  value={bulletsToLines(module.excluded)}
                  onChange={(event) =>
                    update(index, { excluded: linesToBullets(event.target.value) })
                  }
                  disabled={disabled}
                  rows={7}
                  placeholder={
                    "No incluido (un punto por línea)\nEj.: Migración histórica\nEj.: Integraciones adicionales"
                  }
                  aria-label={`No incluido en módulo ${index + 1}`}
                  className="resize-y text-sm"
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
