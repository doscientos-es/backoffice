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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, FileText, Mail, MailPlus, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { createReminder } from "../../reminders/actions";
import { logLeadCall, logLeadEmail, logLeadNote } from "../actions";
import { EmailComposer } from "./email-composer";

type Props = {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  sendEnabled: boolean;
  sendDisabledReason?: string;
  aiEnabled: boolean;
};

export function LeadQuickActions({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  sendEnabled,
  sendDisabledReason,
  aiEnabled,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <CallDialog leadId={leadId} leadName={leadName} leadPhone={leadPhone} />
      <SendEmailDialog
        leadId={leadId}
        leadEmail={leadEmail}
        sendEnabled={sendEnabled}
        sendDisabledReason={sendDisabledReason}
        aiEnabled={aiEnabled}
      />
      <LogEmailDialog leadId={leadId} leadName={leadName} leadEmail={leadEmail} />
      <ScheduleDialog leadId={leadId} leadName={leadName} />
      <NoteDialog leadId={leadId} />
    </div>
  );
}

function ActionTrigger({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-3">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}

function ActionDialog({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  children,
  wide,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={wide ? "sm:max-w-lg" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ── Shared follow-up utilities ────────────────────────────────────────────────

/** datetime-local needs `YYYY-MM-DDTHH:mm` in the user's local TZ. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const SCHEDULE_PRESETS: { label: string; minutes: number }[] = [
  { label: "En 1 h", minutes: 60 },
  { label: "Mañana", minutes: 60 * 24 },
  { label: "En 3 días", minutes: 60 * 24 * 3 },
  { label: "En 1 semana", minutes: 60 * 24 * 7 },
];

function FollowUpSection({
  enabled,
  onEnabledChange,
  remindAt,
  onRemindAtChange,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  remindAt: string;
  onRemindAtChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox checked={enabled} onCheckedChange={(v) => onEnabledChange(v === true)} />
        <span className="text-sm font-medium">Programar seguimiento</span>
      </label>
      {enabled && (
        <div className="flex flex-col gap-1.5 pt-1">
          <Label className="text-xs text-muted-foreground">Recordar el</Label>
          <Input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => onRemindAtChange(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {SCHEDULE_PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const d = new Date(Date.now() + p.minutes * 60_000);
                  d.setSeconds(0, 0);
                  onRemindAtChange(toLocalInputValue(d));
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- CALL ----------------

function CallDialog({
  leadId,
  leadName,
  leadPhone,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("connected");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpAt, setFollowUpAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInputValue(d);
  });
  const feedback = useFormFeedback();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadCall({
      leadId,
      notes: notes || undefined,
      transcript: transcript || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      outcome,
    });
    if (!res.ok) return feedback.setError(res.error);
    if (followUpEnabled && followUpAt) {
      await createReminder({
        leadId,
        title: `Llamar a ${leadName}`,
        remindAt: new Date(followUpAt).toISOString(),
      });
    }
    feedback.setSuccess("Llamada registrada");
    setNotes("");
    setTranscript("");
    setDuration("");
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <ActionDialog
      trigger={<ActionTrigger icon={<Phone className="size-4" />} label="Llamada" />}
      title="Registrar llamada"
      description={leadPhone ? `Teléfono: ${leadPhone}` : "Anota los puntos clave de la llamada."}
      open={open}
      onOpenChange={setOpen}
      wide
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="call-outcome" className="text-xs font-medium">
              Resultado
            </Label>
            <Select
              id="call-outcome"
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
            <Label htmlFor="call-duration" className="text-xs font-medium">
              Duración (min)
            </Label>
            <Input
              id="call-duration"
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
          <Label htmlFor="call-notes" className="text-xs font-medium">
            Notas
          </Label>
          <Textarea
            id="call-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Puntos clave, próximos pasos…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="call-transcript" className="text-xs font-medium">
            Transcripción <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="call-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            placeholder="Pega aquí la transcripción si la tienes…"
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
    </ActionDialog>
  );
}

// ---------------- SEND EMAIL (via Resend, reuses EmailComposer) ----------------

function SendEmailDialog({
  leadId,
  leadEmail,
  sendEnabled,
  sendDisabledReason,
  aiEnabled,
}: {
  leadId: string;
  leadEmail: string | null;
  sendEnabled: boolean;
  sendDisabledReason?: string;
  aiEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const disabled = !sendEnabled || !leadEmail;
  const reason = !leadEmail ? "Este lead no tiene email." : sendDisabledReason;
  return (
    <ActionDialog
      trigger={<ActionTrigger icon={<Mail className="size-4" />} label="Enviar email" />}
      title="Enviar email"
      description={leadEmail ?? undefined}
      open={open}
      onOpenChange={setOpen}
      wide
    >
      <EmailComposer
        leadId={leadId}
        defaultTo={leadEmail ?? ""}
        disabled={disabled}
        disabledReason={reason}
        aiEnabled={aiEnabled}
      />
    </ActionDialog>
  );
}

// ---------------- LOG EMAIL (manual, no send) ----------------

function LogEmailDialog({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [counterparty, setCounterparty] = useState(leadEmail ?? "");
  const feedback = useFormFeedback();

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
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <ActionDialog
      trigger={<ActionTrigger icon={<MailPlus className="size-4" />} label="Registrar email" />}
      title="Registrar email"
      description="Para emails enviados o recibidos fuera de la app."
      open={open}
      onOpenChange={setOpen}
      wide
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-direction" className="text-xs font-medium">
              Dirección
            </Label>
            <Select
              id="email-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}
            >
              <option value="incoming">Recibido</option>
              <option value="outgoing">Enviado</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-counterparty" className="text-xs font-medium">
              {direction === "incoming" ? "De" : "Para"}
            </Label>
            <Input
              id="email-counterparty"
              type="email"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-subject" className="text-xs font-medium">
            Asunto <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={300}
            placeholder="Asunto del email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-body" className="text-xs font-medium">
            Cuerpo <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="email-body"
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
    </ActionDialog>
  );
}

// ---------------- NOTE ----------------

function NoteDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const feedback = useFormFeedback();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadNote({ leadId, content });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Nota añadida");
    setContent("");
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <ActionDialog
      trigger={<ActionTrigger icon={<FileText className="size-4" />} label="Nota" />}
      title="Añadir nota"
      open={open}
      onOpenChange={setOpen}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          autoFocus
          required
          maxLength={8000}
          placeholder="Escribe tu nota…"
        />
        <div className="flex items-center justify-end gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
            Guardar
          </SubmitButton>
        </div>
      </form>
    </ActionDialog>
  );
}

// ---------------- SCHEDULE (reminder) ----------------

const SCHEDULE_PRESETS: { label: string; minutes: number }[] = [
  { label: "En 1 h", minutes: 60 },
  { label: "Mañana", minutes: 60 * 24 },
  { label: "En 3 días", minutes: 60 * 24 * 3 },
  { label: "En 1 semana", minutes: 60 * 24 * 7 },
];

/** datetime-local needs `YYYY-MM-DDTHH:mm` in the user's local TZ. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ScheduleDialog({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`Llamar a ${leadName}`);
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toLocalInputValue(d);
  });
  const [notes, setNotes] = useState("");
  const feedback = useFormFeedback();

  function applyPreset(minutes: number) {
    const d = new Date(Date.now() + minutes * 60_000);
    d.setSeconds(0, 0);
    setRemindAt(toLocalInputValue(d));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.setPending();
    const res = await createReminder({
      leadId,
      title: title.trim(),
      remindAt: new Date(remindAt).toISOString(),
      notes: notes || undefined,
    });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Aviso programado");
    setNotes("");
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <ActionDialog
      trigger={<ActionTrigger icon={<CalendarClock className="size-4" />} label="Agendar" />}
      title="Agendar seguimiento"
      description="Crea un aviso para esta lead (llamada, email, recordatorio…)."
      open={open}
      onOpenChange={setOpen}
      wide
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-title" className="text-xs font-medium">
            Título <span className="text-destructive">*</span>
          </Label>
          <Input
            id="schedule-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-when" className="text-xs font-medium">
            Fecha y hora <span className="text-destructive">*</span>
          </Label>
          <Input
            id="schedule-when"
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SCHEDULE_PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => applyPreset(p.minutes)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-notes" className="text-xs font-medium">
            Notas <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="schedule-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Contexto, qué tratar, próximos pasos…"
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
            Agendar
          </SubmitButton>
        </div>
      </form>
    </ActionDialog>
  );
}

