"use client";

// Compartido entre el drawer de la lista de leads y la ficha del lead.
// Única fuente de verdad para las 3 fast actions (llamada, email, nota)
// con opción de agendar follow-up. Todas refrescan el router tras éxito.

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { defaultMeetingEnd, defaultMeetingStart } from "@/lib/calendar/date-presets";
import { defaultFollowUpDateTime } from "@/lib/reminders/date-presets";
import type { CallOutcome } from "@/lib/schemas/lead";
import { addMinutesToDatetimeLocal, datetimeLocalToIso } from "@/lib/utils/date-time";
import { FileText, Loader2, Mail, NotebookPen, Phone, Send, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { createReminder } from "../reminders/actions";
import { EmailComposer } from "./[id]/email-composer";
import { logLeadCall, logLeadEmail, logLeadNote, scheduleLeadMeeting } from "./actions";
import { CallDigestDialog } from "./call-digest-dialog";

// ─── QMeetDialog ──────────────────────────────────────────────────────────────

/** Shape passed for Meet invitee selection — subset of team_members with email. */
export type MeetMember = { id: string; name: string; email: string };

// ─── Shared helper: member checkboxes ────────────────────────────────────────

function MemberCheckboxes({
  members,
  selected,
  onToggle,
}: {
  members: MeetMember[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">
        Invitar compañeros <span className="text-muted-foreground/60">(opcional)</span>
      </Label>
      <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/30 p-2.5">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Checkbox
              id={`member-${m.id}`}
              checked={selected.has(m.id)}
              onCheckedChange={() => onToggle(m.id)}
            />
            <label
              htmlFor={`member-${m.id}`}
              className="flex-1 cursor-pointer select-none py-0.5 text-sm"
            >
              {m.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function useMemberToggle() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function emails(members: MeetMember[]) {
    return members.filter((m) => selected.has(m.id)).map((m) => m.email);
  }
  return { selected, toggle, emails };
}

// ─── QMeetDialog — scheduled meeting ─────────────────────────────────────────

export function QMeetDialog({
  leadId,
  leadName,
  leadEmail,
  projects,
  meetMembers = [],
}: {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  projects: Array<{ id: string; name: string }>;
  meetMembers?: MeetMember[];
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [title, setTitle] = useState(`Reunión con ${leadName}`);
  const [start, setStart] = useState(defaultMeetingStart);
  const [end, setEnd] = useState(defaultMeetingEnd);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const members = useMemberToggle();
  const feedback = useFormFeedback();
  const router = useRouter();

  function handleStartChange(val: string) {
    setStart(val);
    const s = new Date(val);
    const e = new Date(end);
    if (e <= s) {
      setEnd(addMinutesToDatetimeLocal(val, 60));
    }
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setConfirmOpen(true);
  }

  async function handleConfirmSchedule() {
    feedback.setPending();
    const attendeeEmails = [...(leadEmail ? [leadEmail] : []), ...members.emails(meetMembers)];
    const res = await scheduleLeadMeeting({
      leadId,
      title,
      description: description.trim() || undefined,
      start: datetimeLocalToIso(start),
      end: datetimeLocalToIso(end),
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      projectId: projectId || undefined,
      withMeet: true,
    });
    if (!res.ok) {
      setConfirmOpen(false);
      return feedback.setError(res.error);
    }
    setConfirmOpen(false);
    feedback.setSuccess("Reunión creada");
    router.refresh();
    if (res.meetUrl) window.open(res.meetUrl, "_blank");
    setTimeout(() => setOpen(false), 600);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Video className="size-3.5 text-muted-foreground" />
            Agendar reunión Meet
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar reunión Google Meet</DialogTitle>
            <DialogDescription>
              {leadEmail
                ? "Se creará en el calendario compartido y se enviará una invitación por email."
                : "Se creará en el calendario compartido. Este lead no tiene email registrado."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-meet-title-${leadId}`} className="text-xs font-medium">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`qa-meet-title-${leadId}`}
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-start-${leadId}`} className="text-xs font-medium">
                  Inicio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`qa-meet-start-${leadId}`}
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-end-${leadId}`} className="text-xs font-medium">
                  Fin <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`qa-meet-end-${leadId}`}
                  type="datetime-local"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            {projects.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-project-${leadId}`} className="text-xs font-medium">
                  Proyecto <span className="text-muted-foreground/60">(opcional)</span>
                </Label>
                <EntityCombobox
                  id={`qa-meet-project-${leadId}`}
                  items={projects.map((p) => ({ id: p.id, label: p.name }))}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="Buscar proyecto…"
                />
              </div>
            )}
            <MemberCheckboxes
              members={meetMembers}
              selected={members.selected}
              onToggle={members.toggle}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-meet-desc-${leadId}`} className="text-xs font-medium">
                Descripción <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-meet-desc-${leadId}`}
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, puntos a tratar…"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Creando…" />
              <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
                Agendar reunión
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={leadEmail ? "¿Enviar invitación de reunión?" : "¿Crear reunión sin invitar al lead?"}
        description={
          <>
            {leadEmail ? (
              <p>
                Se enviará una invitación real de Google Calendar a <strong>{leadEmail}</strong>.
              </p>
            ) : (
              <p>Este lead no tiene email registrado y no recibirá una invitación.</p>
            )}
            <p className="mt-2">
              <strong>{title}</strong> · {start.replace("T", " ")}.
            </p>
            <p className="mt-2">
              {leadEmail
                ? "El lead recibirá la invitación en su calendario."
                : "La reunión se creará sin invitación para el lead."}
            </p>
          </>
        }
        confirmLabel={leadEmail ? "Sí, enviar invitación" : "Sí, crear reunión"}
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmSchedule()}
      />
    </>
  );
}

// ─── QMeetNowDialog — instant Meet ───────────────────────────────────────────

export function QMeetNowDialog({
  leadId,
  leadName,
  leadEmail,
  meetMembers = [],
}: {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  meetMembers?: MeetMember[];
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [description, setDescription] = useState("");
  const members = useMemberToggle();
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setConfirmOpen(true);
  }

  async function handleConfirmCreate() {
    feedback.setPending();
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);
    const attendeeEmails = [...(leadEmail ? [leadEmail] : []), ...members.emails(meetMembers)];
    const res = await scheduleLeadMeeting({
      leadId,
      title: `Reunión con ${leadName}`,
      description: description.trim() || undefined,
      start: now.toISOString(),
      end: endTime.toISOString(),
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      withMeet: true,
    });
    if (!res.ok) {
      setConfirmOpen(false);
      return feedback.setError(res.error);
    }
    setConfirmOpen(false);
    feedback.setSuccess("¡Meet creado!");
    router.refresh();
    if (res.meetUrl) window.open(res.meetUrl, "_blank");
    setTimeout(() => setOpen(false), 600);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Video className="size-3.5 text-green-500" />
            Meet ahora
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar Meet ahora</DialogTitle>
            <DialogDescription>
              {leadEmail
                ? "Se crea el enlace Meet, se abre en una nueva pestaña y se envía invitación."
                : "Se crea el enlace Meet y se abre en una nueva pestaña. Este lead no tiene email registrado."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <MemberCheckboxes
              members={meetMembers}
              selected={members.selected}
              onToggle={members.toggle}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-now-desc-${leadId}`} className="text-xs font-medium">
                Notas <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-now-desc-${leadId}`}
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, puntos a tratar…"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Creando…" />
              <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
                Crear y unirse
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={leadEmail ? "¿Enviar invitación y abrir Meet?" : "¿Crear Meet sin invitar al lead?"}
        description={
          <>
            {leadEmail ? (
              <p>
                Se enviará una invitación real de Google Calendar a <strong>{leadEmail}</strong>.
              </p>
            ) : (
              <p>Este lead no tiene email registrado y no recibirá una invitación.</p>
            )}
            <p className="mt-2">También se abrirá el enlace de Meet en una nueva pestaña.</p>
          </>
        }
        confirmLabel={leadEmail ? "Sí, crear y enviar" : "Sí, crear y abrir Meet"}
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmCreate()}
      />
    </>
  );
}

function FollowUpSection({
  idPrefix,
  enabled,
  onEnabledChange,
  remindAt,
  onRemindAtChange,
}: {
  idPrefix: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  remindAt: string;
  onRemindAtChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2.5">
      <label
        htmlFor={`${idPrefix}-followup`}
        className="flex items-center gap-2 text-xs font-medium"
      >
        <Checkbox
          id={`${idPrefix}-followup`}
          checked={enabled}
          onCheckedChange={(v) => onEnabledChange(v === true)}
        />
        Crear aviso de seguimiento
      </label>
      {enabled && (
        <Input
          id={`${idPrefix}-followup-at`}
          type="datetime-local"
          value={remindAt}
          onChange={(e) => onRemindAtChange(e.target.value)}
          className="h-8 text-xs"
        />
      )}
    </div>
  );
}

export function QCallDialog({
  leadId,
  leadName,
  leadPhone,
  leadEmail,
  aiEnabled,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  leadEmail: string | null;
  aiEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestKey, setDigestKey] = useState(0);
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpAt, setFollowUpAt] = useState(defaultFollowUpDateTime);
  // Meet notes import
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const feedback = useFormFeedback();
  const router = useRouter();

  async function handleImportNotes() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/crm/meet-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drive_url: importUrl }),
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error al importar");
      setNotes(json.text ?? "");
      setShowImport(false);
      setImportUrl("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
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
        remindAt: datetimeLocalToIso(followUpAt),
      });
    }
    feedback.setSuccess("Llamada registrada");
    setNotes("");
    setTranscript("");
    setDuration("");
    setFollowUpEnabled(false);
    setDigestKey((key) => key + 1);
    router.refresh();
    setOpen(false);
    setDigestOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Phone className="size-3.5 text-muted-foreground" />
            Registrar llamada
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>Registrar llamada</DialogTitle>
            {leadPhone && <DialogDescription>{leadPhone}</DialogDescription>}
          </DialogHeader>
          <form className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-call-outcome-${leadId}`} className="text-xs font-medium">
                  Resultado
                </Label>
                <Select
                  id={`qa-call-outcome-${leadId}`}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as CallOutcome)}
                >
                  <option value="connected">Contactado</option>
                  <option value="voicemail">Buzón de voz</option>
                  <option value="no_answer">Sin respuesta</option>
                  <option value="busy">Comunicando</option>
                  <option value="wrong_number">Número erróneo</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-call-duration-${leadId}`} className="text-xs font-medium">
                  Duración (min)
                </Label>
                <Input
                  id={`qa-call-duration-${leadId}`}
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
              <div className="flex items-center justify-between">
                <Label htmlFor={`qa-call-notes-${leadId}`} className="text-xs font-medium">
                  Notas <span className="text-muted-foreground/60">(o transcripción)</span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowImport(!showImport);
                    setImportError(null);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <FileText className="size-3" />
                  Importar desde Meet
                </button>
              </div>
              {showImport && (
                <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground">
                    Pega la URL del documento de notas de Google Meet
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://docs.google.com/document/d/…"
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={handleImportNotes}
                      disabled={importing || !importUrl.trim()}
                    >
                      {importing ? <Loader2 className="size-3 animate-spin" /> : "Importar"}
                    </Button>
                  </div>
                  {importError && <p className="text-xs text-destructive">{importError}</p>}
                </div>
              )}
              <Textarea
                id={`qa-call-notes-${leadId}`}
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Puntos clave, próximos pasos…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-call-transcript-${leadId}`} className="text-xs font-medium">
                Transcripción <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-call-transcript-${leadId}`}
                rows={4}
                maxLength={50000}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Pega aquí la transcripción si la tienes…"
                className="font-mono text-xs"
              />
            </div>
            <FollowUpSection
              idPrefix={`qa-call-${leadId}`}
              enabled={followUpEnabled}
              onEnabledChange={setFollowUpEnabled}
              remindAt={followUpAt}
              onRemindAtChange={setFollowUpAt}
            />
            <div className="flex shrink-0 items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
              <SubmitButton loading={feedback.pending}>Registrar</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <CallDigestDialog
        leadId={leadId}
        leadName={leadName}
        leadEmail={leadEmail}
        aiEnabled={aiEnabled}
        open={digestOpen}
        onOpenChange={setDigestOpen}
        draftKey={digestKey}
      />
    </>
  );
}

export function QEmailDialog({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"incoming" | "outgoing">("outgoing");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
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
            <Label htmlFor={`qa-email-dir-${leadId}`} className="text-xs font-medium">
              Dirección
            </Label>
            <Select
              id={`qa-email-dir-${leadId}`}
              value={direction}
              onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}
            >
              <option value="outgoing">Enviado</option>
              <option value="incoming">Recibido</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-subj-${leadId}`} className="text-xs font-medium">
              Asunto <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`qa-email-subj-${leadId}`}
              required
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-body-${leadId}`} className="text-xs font-medium">
              Cuerpo{" "}
              <span className="text-muted-foreground/60">(opcional, mejora el resumen IA)</span>
            </Label>
            <Textarea
              id={`qa-email-body-${leadId}`}
              rows={5}
              maxLength={50000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Pega o resume el contenido del email…"
            />
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

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
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
          <Textarea
            rows={4}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Observaciones, contexto, próximos pasos…"
          />
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Guardar nota</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QSendEmailDialog({
  leadId,
  leadEmail,
  aiEnabled,
}: {
  leadId: string;
  leadEmail: string | null;
  aiEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSuccess() {
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <Send className="size-3.5 text-muted-foreground" />
          Enviar email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar email</DialogTitle>
          {leadEmail && <DialogDescription>{leadEmail}</DialogDescription>}
        </DialogHeader>
        <EmailComposer
          leadId={leadId}
          defaultTo={leadEmail ?? ""}
          disabled={!leadEmail}
          disabledReason="Este lead no tiene email registrado."
          aiEnabled={aiEnabled}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
