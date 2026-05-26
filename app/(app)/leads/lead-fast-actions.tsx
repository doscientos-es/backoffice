"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/utils";
import { Brain, Mail, Phone, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { logLeadCall, logLeadEmail } from "./actions";

export type FastInteraction = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  created_at: string;
};

export type FastLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ai_summary: string | null;
  ai_updated_at: string | null;
  recent_interactions: FastInteraction[];
};

type Props = {
  lead: FastLead;
  aiEnabled: boolean;
};

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  email_delivered: "Email entregado",
  email_opened: "Email abierto",
  email_clicked: "Email con clic",
  email_bounced: "Email rebotado",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  portal_view: "Portal visto",
  portal_accept: "Propuesta aceptada",
  portal_reject: "Propuesta rechazada",
};

function excerpt(body: string | null, max = 120): string | null {
  if (!body) return null;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function LeadFastActions({ lead, aiEnabled }: Props) {
  // Detenemos pointerdown para no activar el drag del kanban al pulsar
  // los iconos. En la vista lista es inocuo.
  return (
    <div
      className="flex items-center gap-0.5"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <CallDialog leadId={lead.id} leadPhone={lead.phone} />
      <EmailDialog leadId={lead.id} leadEmail={lead.email} />
      <MemoryHoverCard lead={lead} aiEnabled={aiEnabled} />
    </div>
  );
}

function IconTrigger({
  label,
  children,
}: { label: string; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground"
    >
      {children}
    </Button>
  );
}

function FastDialog({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ---------------- CALL ----------------

function CallDialog({
  leadId,
  leadPhone,
}: { leadId: string; leadPhone: string | null }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("connected");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadCall({
      leadId,
      notes: notes || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      outcome,
    });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Llamada registrada");
    setNotes("");
    setDuration("");
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <FastDialog
      trigger={
        <IconTrigger label="Registrar llamada">
          <Phone className="size-3.5" />
        </IconTrigger>
      }
      title="Registrar llamada"
      description={leadPhone ? `Teléfono: ${leadPhone}` : "Sin teléfono guardado."}
      open={open}
      onOpenChange={setOpen}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`fast-call-outcome-${leadId}`} className="text-xs font-medium">
              Resultado
            </Label>
            <Select
              id={`fast-call-outcome-${leadId}`}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="connected">Contactado</option>
              <option value="voicemail">Buzón de voz</option>
              <option value="no_answer">Sin respuesta</option>
              <option value="busy">Comunicando</option>
              <option value="wrong_number">Número erróneo</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`fast-call-duration-${leadId}`} className="text-xs font-medium">
              Duración (min)
            </Label>
            <Input
              id={`fast-call-duration-${leadId}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fast-call-notes-${leadId}`} className="text-xs font-medium">
            Notas
          </Label>
          <Textarea
            id={`fast-call-notes-${leadId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            required
            placeholder="Puntos clave, próximos pasos…"
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
            Registrar
          </SubmitButton>
        </div>
      </form>
    </FastDialog>
  );
}


// ---------------- EMAIL (manual log) ----------------

function EmailDialog({
  leadId,
  leadEmail,
}: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"incoming" | "outgoing">("outgoing");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [counterparty, setCounterparty] = useState(leadEmail ?? "");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadEmail({
      leadId,
      direction,
      subject,
      bodyHtml: bodyHtml || undefined,
      counterparty: counterparty || undefined,
    });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Email registrado");
    setSubject("");
    setBodyHtml("");
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <FastDialog
      trigger={
        <IconTrigger label="Registrar email">
          <Mail className="size-3.5" />
        </IconTrigger>
      }
      title="Registrar email"
      description="Para emails enviados o recibidos fuera de la app."
      open={open}
      onOpenChange={setOpen}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`fast-email-dir-${leadId}`} className="text-xs font-medium">
              Dirección
            </Label>
            <Select
              id={`fast-email-dir-${leadId}`}
              value={direction}
              onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}
            >
              <option value="outgoing">Enviado</option>
              <option value="incoming">Recibido</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`fast-email-cp-${leadId}`} className="text-xs font-medium">
              {direction === "incoming" ? "De" : "Para"}
            </Label>
            <Input
              id={`fast-email-cp-${leadId}`}
              type="email"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fast-email-subj-${leadId}`} className="text-xs font-medium">
            Asunto <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`fast-email-subj-${leadId}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={300}
            placeholder="Asunto del email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fast-email-body-${leadId}`} className="text-xs font-medium">
            Cuerpo <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id={`fast-email-body-${leadId}`}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={5}
            placeholder="Pega aquí el contenido del email…"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
            Registrar
          </SubmitButton>
        </div>
      </form>
    </FastDialog>
  );
}


// ---------------- MEMORY (hover card) ----------------

function MemoryHoverCard({
  lead,
  aiEnabled,
}: { lead: FastLead; aiEnabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!aiEnabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/ai/summarize-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar el resumen.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  const hasInteractions = lead.recent_interactions.length > 0;
  const hasSummary = Boolean(lead.ai_summary);

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Memoria del lead"
          className="text-muted-foreground hover:text-foreground"
        >
          <Brain className="size-3.5" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-80 p-0">
        <div className="flex flex-col divide-y divide-border">
          <div className="px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3 opacity-60" />
              Descripción del lead
            </div>
            {hasSummary ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {lead.ai_summary}
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground/80">
                Aún no hay descripción generada para este lead.
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              {aiEnabled ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  <Sparkles className="size-3" />
                  {loading
                    ? "Analizando…"
                    : hasSummary
                      ? "Actualizar"
                      : "Generar con IA"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled
                  title="Falta OPENAI_API_KEY en las variables de entorno"
                >
                  <Sparkles className="size-3 opacity-60" />
                  Generar con IA · No disponible
                </Button>
              )}
              {error ? (
                <span className="text-[10px] text-destructive">{error}</span>
              ) : null}
            </div>
            {!aiEnabled ? (
              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/70">
                Sin clave de API configurada. La IA usará emails, llamadas y
                notas para resumir lo que pide el lead.
              </p>
            ) : null}
          </div>
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-xs font-semibold text-foreground">
              Últimas acciones
            </div>
            {hasInteractions ? (
              <ul className="flex flex-col gap-1.5">
                {lead.recent_interactions.slice(0, 3).map((i) => {
                  const snippet = excerpt(i.body, 90) ?? i.subject;
                  return (
                    <li key={i.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-medium text-foreground">
                          {INTERACTION_LABEL[i.type] ?? i.type}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {relativeTime(i.created_at)}
                        </span>
                      </div>
                      {snippet ? (
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {snippet}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground/80">
                Sin interacciones registradas todavía.
              </p>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
