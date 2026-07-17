"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type SocialPostSuggestion, normalizeHashtags } from "@/lib/social/ai-suggestion";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

export function AIPostSuggester({
  disabled,
  onSuggestion,
}: {
  disabled?: boolean;
  onSuggestion: (suggestion: SocialPostSuggestion) => void;
}) {
  const [directive, setDirective] = useState("");
  const [suggestion, setSuggestion] = useState<SocialPostSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/social/ai/suggest-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive: directive.trim() || undefined }),
      });
      const result = (await response.json()) as SocialPostSuggestion & { error?: string };
      if (!response.ok) {
        setError(
          result.error === "ai_disabled"
            ? "La IA no está configurada."
            : result.error === "rate_limited"
              ? "Has alcanzado el límite temporal de propuestas."
              : "No se ha podido generar la propuesta.",
        );
        return;
      }
      const normalizedResult = { ...result, hashtags: normalizeHashtags(result.hashtags) };
      setSuggestion(normalizedResult);
      onSuggestion(normalizedResult);
    } catch {
      setError("Error de red al generar la propuesta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            Proponer una publicación con IA
          </div>
          <p className="text-xs text-muted-foreground">
            Analiza leads, proyectos y pain points para preparar una idea, el briefing visual y la
            descripción. La foto la haces tú.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-directive" className="text-xs font-medium">
            Directriz opcional
          </Label>
          <Textarea
            id="ai-directive"
            rows={2}
            maxLength={1000}
            placeholder="Ej.: enfócalo en errores habituales al contratar una web y que sea fácil de fotografiar en la oficina"
            value={directive}
            onChange={(event) => setDirective(event.target.value)}
            disabled={disabled || loading}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={suggest}
          disabled={disabled || loading}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? "Analizando contexto…" : "Proponer publicación"}
        </Button>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        {suggestion && (
          <div className="flex flex-col gap-4 border-t border-border pt-4 text-sm">
            <div>
              <p className="font-medium">{suggestion.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{suggestion.angle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Brief label="Audiencia" value={suggestion.audience} />
              <Brief label="Por qué ahora" value={suggestion.rationale} />
              <Brief label="Concepto visual" value={suggestion.visualConcept} />
              <Brief label="Layout" value={suggestion.layout} />
              <Brief label="Brief de la foto" value={suggestion.photoBrief} />
              <Brief label="CTA" value={suggestion.callToAction} />
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Descripción preparada
              </p>
              <p className="whitespace-pre-wrap text-sm">{suggestion.caption}</p>
              {suggestion.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-primary">{suggestion.hashtags.join(" ")}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Brief({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("rounded-lg border border-border/70 p-3", value && "bg-background/50")}>
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed">{value}</p>
    </div>
  );
}
