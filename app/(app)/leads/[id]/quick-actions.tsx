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
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Mail, MailPlus, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { logLeadCall, logLeadEmail, logLeadNote } from "../actions";
import { EmailComposer } from "./email-composer";

type Props = {
  leadId: string;
  leadEmail: string | null;
  leadPhone: string | null;
  sendEnabled: boolean;
  sendDisabledReason?: string;
  aiEnabled: boolean;
};

export function LeadQuickActions({
  leadId,
  leadEmail,
  leadPhone,
  sendEnabled,
  sendDisabledReason,
  aiEnabled,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <CallDialog leadId={leadId} leadPhone={leadPhone} />
      <SendEmailDialog
        leadId={leadId}
        leadEmail={leadEmail}
        sendEnabled={sendEnabled}
        sendDisabledReason={sendDisabledReason}
        aiEnabled={aiEnabled}
      />
      <LogEmailDialog leadId={leadId} leadEmail={leadEmail} />
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

// ---------------- CALL ----------------

function CallDialog({ leadId, leadPhone }: { leadId: string; leadPhone: string | null }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("connected");
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
