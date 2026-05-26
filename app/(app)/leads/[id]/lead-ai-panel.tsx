"use client";

import { AiNotice } from "@/components/ui/ai-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export type LeadAiData = {
  ai_summary: string | null;
  ai_suggested_next_step: string | null;
  ai_temperature: "hot" | "warm" | "cold" | null;
  ai_confidence: number | null;
  ai_updated_at: string | null;
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

export function LeadAiPanel({ leadId, aiEnabled, initialData }: Props) {
  const [data, setData] = useState<LeadAiData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!aiEnabled) {
    return (
      <AiNotice message="El asistente de IA no está activo. Añade OPENAI_API_KEY a las variables de entorno para generar resúmenes de leads automáticamente." />
    );
  }

  async function handleSummarize() {
    setLoading(true);
    setError(null);
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
        ai_updated_at: new Date().toISOString(),
      });
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
      {hasSummary ? (
        <>
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

          <p className="text-sm">{data.ai_summary}</p>

          {data.ai_suggested_next_step && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Siguiente paso</p>
              <p className="text-sm">{data.ai_suggested_next_step}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sin análisis generado aún. Pulsa el botón para que la IA analice el lead.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSummarize}
          disabled={loading}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? "Analizando…" : hasSummary ? "Actualizar análisis" : "Generar análisis"}
        </Button>
      </div>
    </div>
  );
}
