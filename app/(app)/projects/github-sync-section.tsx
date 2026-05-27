"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Github, Link2, RefreshCw } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

export type GitHubSyncMode = "none" | "link_only" | "bidirectional";

export interface GitHubSyncSectionProps {
  idPrefix: string;
  defaultMode?: GitHubSyncMode;
  defaultRepoUrl?: string | null;
  defaultInstallationId?: number | null;
  defaultAutoSync?: boolean;
}

const OPTIONS: Array<{
  value: GitHubSyncMode;
  title: string;
  description: string;
  icon: ReactNode;
}> = [
    {
      value: "none",
      title: "Sin GitHub",
      description: "El proyecto vive sólo en el backoffice.",
      icon: <Github className="size-4" />,
    },
    {
      value: "link_only",
      title: "Solo enlace",
      description: "Repo externo: enlazamos pero nunca escribimos en GitHub.",
      icon: <Link2 className="size-4" />,
    },
    {
      value: "bidirectional",
      title: "Sincronización completa",
      description: "Tareas e hitos crean y reciben issues/milestones automáticamente.",
      icon: <RefreshCw className="size-4" />,
    },
  ];

export function GitHubSyncSection({
  idPrefix,
  defaultMode = "none",
  defaultRepoUrl,
  defaultInstallationId,
  defaultAutoSync = true,
}: GitHubSyncSectionProps) {
  const [mode, setMode] = useState<GitHubSyncMode>(defaultMode);
  const groupId = useId();
  const showRepo = mode !== "none";
  const showSync = mode === "bidirectional";

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Integración con GitHub
      </legend>

      <div role="radiogroup" aria-labelledby={groupId} className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const id = `${idPrefix}-mode-${opt.value}`;
          const checked = mode === opt.value;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-xs transition-colors",
                checked
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <input
                id={id}
                type="radio"
                name="github_sync_mode"
                value={opt.value}
                checked={checked}
                onChange={() => setMode(opt.value)}
                className="sr-only"
              />
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {opt.icon}
                {opt.title}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{opt.description}</span>
            </label>
          );
        })}
      </div>

      {showRepo ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="URL del repositorio" htmlFor={`${idPrefix}-repo`} required>
            <Input
              id={`${idPrefix}-repo`}
              name="github_repo"
              type="url"
              inputMode="url"
              required
              defaultValue={defaultRepoUrl ?? ""}
              placeholder="https://github.com/owner/repo"
            />
          </Field>
          {showSync ? (
            <Field
              label="Installation ID de la GitHub App"
              htmlFor={`${idPrefix}-installation`}
              hint="Necesario para que el backoffice pueda escribir."
              required
            >
              <Input
                id={`${idPrefix}-installation`}
                name="github_installation_id"
                inputMode="numeric"
                required
                defaultValue={defaultInstallationId ?? ""}
                placeholder="123456"
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {showSync ? (
        <label className="flex items-center gap-2 rounded-md border border-border bg-background p-2.5 text-xs">
          <input
            type="checkbox"
            name="github_auto_sync"
            defaultChecked={defaultAutoSync}
            className="size-4 rounded border-border text-primary focus:ring-1 focus:ring-primary"
          />
          <span className="flex-1">
            <span className="font-medium">Auto-crear issues y milestones</span>
            <span className="ml-1 text-muted-foreground">
              al añadir tareas o hitos desde el backoffice.
            </span>
          </span>
        </label>
      ) : null}

      <details className="rounded-md border border-border bg-background/60 text-xs">
        <summary className="cursor-pointer select-none px-3 py-2 font-medium text-muted-foreground hover:text-foreground">
          ¿Qué ocurre en GitHub en cada modo?
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">Acción en backoffice</th>
                <th className="px-3 py-1.5 font-medium">Sin GitHub</th>
                <th className="px-3 py-1.5 font-medium">Solo enlace</th>
                <th className="px-3 py-1.5 font-medium">Sincronización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {HELP_ROWS.map((row) => (
                <tr key={row.action}>
                  <td className="px-3 py-1.5 font-medium text-foreground">{row.action}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{row.none}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{row.link}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{row.full}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </fieldset>
  );
}

const HELP_ROWS: Array<{ action: string; none: string; link: string; full: string }> = [
  {
    action: "Crear tarea",
    none: "—",
    link: "Botón para abrir issue prellenado en GitHub.com",
    full: "Crea issue automáticamente",
  },
  {
    action: "Crear hito",
    none: "—",
    link: "No se toca GitHub",
    full: "Crea milestone automáticamente",
  },
  {
    action: "Recibir webhook",
    none: "Ignorado",
    link: "Ignorado",
    full: "Actualiza tarea local",
  },
];

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: { label: string; htmlFor: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
