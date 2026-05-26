"use client";

// Compartido entre el drawer de la lista de leads y la ficha del lead.
// Mantiene una sola fuente de verdad para las 3 fast actions básicas
// (llamada, email, nota). Todas refrescan el router tras éxito.

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
import { Mail, NotebookPen, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logLeadCall, logLeadEmail, logLeadNote } from "./actions";

export function QCallDialog({ leadId, leadPhone }: { leadId: string; leadPhone: string | null }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("connected");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadCall({ leadId, notes: notes || undefined, outcome });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Registrado");
    setNotes("");
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <Phone className="size-3.5 text-muted-foreground" />
          Registrar llamada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar llamada</DialogTitle>
          {leadPhone && <DialogDescription>{leadPhone}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-call-outcome-${leadId}`} className="text-xs font-medium">Resultado</Label>
            <Select id={`qa-call-outcome-${leadId}`} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="connected">Contactado</option>
              <option value="voicemail">Buzón de voz</option>
              <option value="no_answer">Sin respuesta</option>
              <option value="busy">Comunicando</option>
              <option value="wrong_number">Número erróneo</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-call-notes-${leadId}`} className="text-xs font-medium">Notas <span className="text-destructive">*</span></Label>
            <Textarea id={`qa-call-notes-${leadId}`} rows={3} required value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Puntos clave, próximos pasos…" />
          </div>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Registrar</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QEmailDialog({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"incoming" | "outgoing">("outgoing");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadEmail({
      leadId,
      direction,
      subject,
      bodyHtml: body.trim() || undefined,
      counterparty: leadEmail ?? undefined,
    });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Registrado");
    setSubject("");
    setBody("");
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <Mail className="size-3.5 text-muted-foreground" />
          Registrar email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar email</DialogTitle>
          <DialogDescription>Para emails enviados o recibidos fuera de la app.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-dir-${leadId}`} className="text-xs font-medium">Dirección</Label>
            <Select id={`qa-email-dir-${leadId}`} value={direction} onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}>
              <option value="outgoing">Enviado</option>
              <option value="incoming">Recibido</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-subj-${leadId}`} className="text-xs font-medium">Asunto <span className="text-destructive">*</span></Label>
            <Input id={`qa-email-subj-${leadId}`} required maxLength={300} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-body-${leadId}`} className="text-xs font-medium">
              Cuerpo <span className="text-muted-foreground/60">(opcional, mejora el resumen IA)</span>
            </Label>
            <Textarea id={`qa-email-body-${leadId}`} rows={5} maxLength={50000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Pega o resume el contenido del email…" />
          </div>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Registrar</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export function QNoteDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadNote({ leadId, content });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Nota guardada");
    setContent("");
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <NotebookPen className="size-3.5 text-muted-foreground" />
          Añadir nota
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Añadir nota</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Textarea rows={4} required value={content} onChange={(e) => setContent(e.target.value)} placeholder="Observaciones, contexto, próximos pasos…" />
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Guardar nota</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
