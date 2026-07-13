"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { FormRow } from "@/components/ui/form-row";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_LABELS, SOCIAL_PLATFORMS } from "@/lib/social/core";
import type { MediaItem, SocialPlatform } from "@/lib/social/core";
import { cn } from "@/lib/utils";
import { CalendarClock, FileText, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PlatformIcon } from "../../_components/platform";
import { createPost } from "../../actions";
import { MediaPicker } from "./media-picker";

type Mode = "draft" | "now" | "schedule";

const MODES: { value: Mode; label: string; hint: string; icon: typeof Send }[] = [
  { value: "now", label: "Publicar ahora", hint: "Se envía a las redes al instante.", icon: Send },
  {
    value: "schedule",
    label: "Programar",
    hint: "Se guarda para publicar más tarde.",
    icon: CalendarClock,
  },
  { value: "draft", label: "Borrador", hint: "Se guarda sin publicar.", icon: FileText },
];

/**
 * Compose a single post and fan it out to the selected networks. Media bytes
 * are uploaded out-of-band (MediaPicker → /api/social/upload); this form only
 * submits public URLs plus the composition metadata to the `createPost` action.
 */
export function ComposeForm({ available }: { available: SocialPlatform[] }) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 4000 });
  const [pending, startTransition] = useTransition();

  const availableSet = useMemo(() => new Set(available), [available]);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(() => new Set(available));
  const [mode, setMode] = useState<Mode>(available.length > 0 ? "now" : "draft");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [perPlatform, setPerPlatform] = useState(false);
  const [perCaptions, setPerCaptions] = useState<Partial<Record<SocialPlatform, string>>>({});

  // Selected networks in a stable display order (drives the per-network fields).
  const selectedList = useMemo(() => SOCIAL_PLATFORMS.filter((p) => platforms.has(p)), [platforms]);

  const canSubmit = useMemo(() => {
    if (platforms.size === 0) return false;
    if (mode === "schedule" && !scheduledLocal) return false;
    return true;
  }, [platforms, mode, scheduledLocal]);

  function togglePlatform(p: SocialPlatform, on: boolean) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  }

  function setPlatformCaption(p: SocialPlatform, value: string) {
    setPerCaptions((prev) => ({ ...prev, [p]: value }));
  }

  /**
   * Collect per-network overrides for the submit payload: only selected networks
   * with a non-empty copy are sent; the rest inherit the shared caption.
   */
  function buildCaptions(): Partial<Record<SocialPlatform, string>> | undefined {
    const entries = selectedList
      .filter((p) => (perCaptions[p] ?? "").trim().length > 0)
      .map((p) => [p, perCaptions[p] as string] as const);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending) {
      feedback.setError("Selecciona al menos una red y, si programas, indica la fecha");
      return;
    }
    const scheduledAt =
      mode === "schedule" && scheduledLocal ? new Date(scheduledLocal).toISOString() : null;
    const captions = perPlatform ? buildCaptions() : undefined;
    feedback.setPending();
    startTransition(async () => {
      const res = await createPost({
        caption,
        captions,
        media,
        platforms: [...platforms],
        mode,
        scheduledAt,
      });
      if (!res.ok) {
        feedback.setError(res.error);
        return;
      }
      feedback.setSuccess(mode === "now" ? "Publicando…" : "Guardado");
      router.push("/social");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="caption" className="text-xs font-medium">
                {perPlatform ? "Texto por defecto" : "Texto"}
              </Label>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="per-platform-copy"
                  className="cursor-pointer text-[11px] font-medium text-muted-foreground"
                >
                  Personalizar por red
                </Label>
                <Switch
                  id="per-platform-copy"
                  checked={perPlatform}
                  onCheckedChange={setPerPlatform}
                />
              </div>
            </div>
            <Textarea
              id="caption"
              rows={5}
              maxLength={3000}
              placeholder="¿Qué quieres compartir?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">
                {perPlatform
                  ? "Se usa en las redes que no tengan un texto propio."
                  : "Se usa el mismo texto en todas las redes."}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {caption.length}/3000
              </span>
            </div>

            {perPlatform && selectedList.length > 0 && (
              <div className="mt-2 flex flex-col gap-4 border-t border-border pt-4">
                {selectedList.map((p) => {
                  const value = perCaptions[p] ?? "";
                  return (
                    <div key={p} className="flex flex-col gap-1.5">
                      <Label
                        htmlFor={`caption-${p}`}
                        className="flex items-center gap-1.5 text-xs font-medium"
                      >
                        <PlatformIcon platform={p} className="size-3.5" />
                        {PLATFORM_LABELS[p]}
                      </Label>
                      <Textarea
                        id={`caption-${p}`}
                        rows={3}
                        maxLength={3000}
                        placeholder={caption || "Usa el texto por defecto"}
                        value={value}
                        onChange={(e) => setPlatformCaption(p, e.target.value)}
                      />
                      <span className="self-end text-[11px] tabular-nums text-muted-foreground">
                        {value.length}/3000
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <FormRow label="Media" htmlFor="media" hint="Imágenes o vídeo. Máximo 10 archivos.">
            <div id="media">
              <MediaPicker value={media} onChange={setMedia} disabled={pending} />
            </div>
          </FormRow>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium">Redes</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {SOCIAL_PLATFORMS.map((p) => {
                const configured = availableSet.has(p);
                const checked = platforms.has(p);
                return (
                  <div
                    key={p}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border border-border p-3 transition-colors",
                      configured
                        ? "hover:border-primary/40 has-data-checked:border-primary has-data-checked:bg-primary/5"
                        : "opacity-60",
                    )}
                  >
                    <Checkbox
                      id={`platform-${p}`}
                      checked={checked}
                      disabled={!configured}
                      onCheckedChange={(v) => togglePlatform(p, v === true)}
                    />
                    <Label
                      htmlFor={`platform-${p}`}
                      className={cn(
                        "flex flex-1 items-center gap-2.5",
                        configured && "cursor-pointer",
                      )}
                    >
                      <PlatformIcon platform={p} className="size-4" />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{PLATFORM_LABELS[p]}</span>
                        {!configured && (
                          <span className="text-[11px] text-muted-foreground">Sin configurar</span>
                        )}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium">Cuándo</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => {
                const active = mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <m.icon className="size-3.5" />
                      {m.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                  </button>
                );
              })}
            </div>
            {mode === "schedule" && (
              <FormRow label="Fecha y hora" htmlFor="scheduledAt" required className="mt-1">
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledLocal}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-border/30"
                />
              </FormRow>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
        <Button asChild variant="ghost" size="sm">
          <Link href="/social">Cancelar</Link>
        </Button>
        <SubmitButton loading={pending} disabled={!canSubmit} pendingLabel="Guardando…">
          {mode === "now" ? "Publicar" : mode === "schedule" ? "Programar" : "Guardar borrador"}
        </SubmitButton>
      </div>
    </form>
  );
}
