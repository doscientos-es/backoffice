"use client";

import { AiNotice } from "@/components/ui/ai-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, CalendarClock, Sparkles } from "lucide-react";
import { useState } from "react";
import { ScheduleReminderDialog } from "./schedule-reminder-dialog";

export type LeadAiData = {
  ai_summary: string | null;
  ai_suggested_next_step: string | null;
  ai_temperature: "hot" | "warm" | "cold" | null;
  ai_confidence: number | null;
  ai_updated_at: string | null;
  ai_tags: string[] | null;
};

type Props = {
  leadId: string;
  aiEnabled: boolean;
  initialData: LeadAiData;
};

const TEMPERATURE_VARIANT = {
  hot: "danger",
  warm: "warning",
  cold: "info",
} as const;

const TEMPERATURE_LABEL = {
  hot: "🔥 Caliente",
  warm: "🌤 Tibio",
  cold: "🧊 Frío",
} as const;

function AiSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-200">
      {/* badges row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
      {/* summary lines */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[75%]" />
      </div>
      {/* next step box */}
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 flex flex-col gap-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[60%]" />
      </div>
    </div>
  );
}

export function LeadAiPanel({ leadId, aiEnabled, initialData }: Props) {
  const [data, setData] = useState<LeadAiData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  if (!aiEnabled) {
    return (
      <AiNotice message="El asistente de IA no está activo. Añade OPENAI_API_KEY a las variables de entorno para generar resúmenes de leads automáticamente." />
    );
  }

  async function handleSummarize() {
    setLoading(true);
    setError(null);
    setFresh(false);
    try {
      const res = await fetch("/api/crm/ai/summarize-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar el resumen.");
      setData({
        ai_summary: json.summary,
        ai_suggested_next_step: json.suggested_next_step,
        ai_temperature: json.temperature,
        ai_confidence: json.confidence,
        ai_updated_at: json.ai_updated_at ?? new Date().toISOString(),
        ai_tags: (json.tags as string[] | null) ?? null,
      });
      setFresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  const hasSummary = Boolean(data.ai_summary);
  const updatedAt = data.ai_updated_at
    ? new Date(data.ai_updated_at).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <AiSkeleton />
      ) : hasSummary ? (
        <div className={cn("flex flex-col gap-3", fresh && "animate-in fade-in duration-500")}>
          <div className="flex items-center gap-2">
            {data.ai_temperature && (
              <Badge variant={TEMPERATURE_VARIANT[data.ai_temperature]}>
                {TEMPERATURE_LABEL[data.ai_temperature]}
              </Badge>
            )}
            {data.ai_confidence != null && (
              <span className="text-xs text-muted-foreground">
                Confianza: {Math.round(data.ai_confidence * 100)}%
              </span>
            )}
            {updatedAt && (
              <span className="ml-auto text-xs text-muted-foreground">{updatedAt}</span>
            )}
          </div>

          <p className="text-sm leading-relaxed">{data.ai_summary}</p>

          {data.ai_tags && data.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.ai_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {data.ai_suggested_next_step && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Siguiente paso</p>
                <ScheduleReminderDialog
                  leadId={leadId}
                  defaultTitle={data.ai_suggested_next_step.slice(0, 200)}
                  defaultNotes={data.ai_suggested_next_step}
                  trigger={
                    <Button size="xs" variant="ghost" className="h-6 gap-1 px-2 text-xs">
                      <CalendarClock className="size-3" />
                      Agendar
                    </Button>
                  }
                />
              </div>
              <p className="text-sm">{data.ai_suggested_next_step}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sin análisis generado aún. Pulsa el botón para que la IA analice el lead.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive animate-in fade-in duration-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleSummarize} disabled={loading}>
          <Sparkles className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {loading ? "Analizando…" : hasSummary ? "Actualizar análisis" : "Generar análisis"}
        </Button>
      </div>
    </div>
  );
}
