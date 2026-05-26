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
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { createReminder } from "../../reminders/actions";
import { QCallDialog, QEmailDialog, QNoteDialog } from "../lead-quick-action-dialogs";

type Props = {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
};

export function LeadQuickActions({ leadId, leadName, leadEmail, leadPhone }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <QCallDialog leadId={leadId} leadPhone={leadPhone} />
      <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
      <QNoteDialog leadId={leadId} />
      <ScheduleDialog leadId={leadId} leadName={leadName} />
    </div>
  );
}

function ActionTrigger({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
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

