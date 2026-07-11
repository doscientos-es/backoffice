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
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { type ReactNode, useState } from "react";
import { createReminder } from "../../reminders/actions";

/** datetime-local needs `YYYY-MM-DDTHH:mm` in the user's local TZ. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultRemindAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalInputValue(d);
}

const SCHEDULE_PRESETS: { label: string; minutes: number }[] = [
  { label: "En 1 h", minutes: 60 },
  { label: "Mañana", minutes: 60 * 24 },
  { label: "En 3 días", minutes: 60 * 24 * 3 },
  { label: "En 1 semana", minutes: 60 * 24 * 7 },
];

type Props = {
  leadId: string;
  /** Element that opens the dialog (rendered via DialogTrigger asChild). */
  trigger: ReactNode;
  /** Prefilled reminder title (e.g. the AI suggested next step). */
  defaultTitle: string;
  defaultNotes?: string;
  onScheduled?: () => void;
};

/**
 * Reminder scheduling dialog shared by the lead quick actions and the AI
 * panel. The trigger and prefilled title/notes are supplied by the caller so
 * the same form (datetime + presets + notes) backs every "Agendar" entry point.
 */
export function ScheduleReminderDialog({
  leadId,
  trigger,
  defaultTitle,
  defaultNotes = "",
  onScheduled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [remindAt, setRemindAt] = useState(defaultRemindAt);
  const [notes, setNotes] = useState(defaultNotes);
  const feedback = useFormFeedback();

  function handleOpenChange(next: boolean) {
    // Re-seed from the (possibly updated) defaults each time it opens so a
    // re-generated next step prefills correctly.
    if (next) {
      setTitle(defaultTitle);
      setNotes(defaultNotes);
      setRemindAt(defaultRemindAt());
      feedback.reset();
    }
    setOpen(next);
  }

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
    onScheduled?.();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar seguimiento</DialogTitle>
          <DialogDescription>
            Crea un aviso para esta lead (llamada, email, recordatorio…).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <FormRow label="Título" htmlFor="schedule-title" required>
            <Input
              id="schedule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </FormRow>
          <FormRow label="Fecha y hora" htmlFor="schedule-when" required>
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
          </FormRow>
          <FormRow label="Notas (opcional)" htmlFor="schedule-notes">
            <Textarea
              id="schedule-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Contexto, qué tratar, próximos pasos…"
            />
          </FormRow>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
              Agendar
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
