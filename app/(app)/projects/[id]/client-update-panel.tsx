"use client";

import { AiNotice } from "@/components/ui/ai-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";

type Props = {
  projectId: string;
  aiEnabled: boolean;
};

export function ClientUpdatePanel({ projectId, aiEnabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [update, setUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!aiEnabled) {
    return <AiNotice message="La IA no está disponible. Añade AI_PROVIDER a las variables de entorno para generar updates de cliente." />;
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setUpdate(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-client-update`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar el update.");
      setUpdate(json.update as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!update) return;
    await navigator.clipboard.writeText(update);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {loading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive animate-in fade-in duration-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {update && !loading && (
        <div className={cn("flex flex-col gap-2 animate-in fade-in duration-500")}>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs" onClick={handleCopy}>
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <textarea
            readOnly
            value={update}
            rows={12}
            className="w-full resize-none rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed text-foreground outline-none"
          />
        </div>
      )}

      {!update && !loading && !error && (
        <p className="text-sm text-muted-foreground">
          Genera un update profesional listo para enviar a tu cliente, basado en las tareas y registros de trabajo del proyecto.
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {update && !loading && (
          <span className="text-xs text-muted-foreground">Revisa el texto antes de enviarlo al cliente.</span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={loading}
          className="ml-auto"
        >
          <Sparkles className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {loading ? "Generando…" : update ? "Regenerar" : "Generar update"}
        </Button>
      </div>
    </div>
  );
}
