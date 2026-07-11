"use client";

import { scheduleLeadMeeting } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { createCalendarEvent } from "@/lib/calendar/actions";
import type { CalendarEvent } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";
import { Bell, CheckSquare, Presentation, Users, Video } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { LeadOption, TeamMember } from "./calendar-grid";

type Kind = "task" | "reminder" | "google_meeting" | "event";
type MeetingTarget = "lead" | "internal";

type Props = {
  open: boolean;
  initialDate?: string;
  teamMembers: TeamMember[];
  leads: LeadOption[];
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
};

const KINDS: { value: Kind; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    value: "task",
    label: "Tarea",
    icon: <CheckSquare className="size-5" />,
    desc: "Con fecha de entrega",
  },
  {
    value: "reminder",
    label: "Recordatorio",
    icon: <Bell className="size-5" />,
    desc: "Con hora de aviso",
  },
  {
    value: "google_meeting",
    label: "Reunión",
    icon: <Video className="size-5" />,
    desc: "En Google Calendar",
  },
  {
    value: "event",
    label: "Charla/Evento",
    icon: <Presentation className="size-5" />,
    desc: "Compartido con el equipo",
  },
];

const INPUT_CLS =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const LABEL_CLS = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

/** Combine a date string + HH:MM time → ISO 8601 UTC string */
function toISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function CalendarCreateDialog({
  open,
  initialDate,
  teamMembers,
  leads,
  onClose,
  onCreated,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [kind, setKind] = useState<Kind>("task");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate ?? today);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [withMeet, setWithMeet] = useState(true);
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Meeting-specific state
  const [meetingTarget, setMeetingTarget] = useState<MeetingTarget>("lead");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Reset on open
  useEffect(() => {
    if (open) {
      setDate(initialDate ?? today);
      setTitle("");
      setDescription("");
      setError(null);
      setAssigneeId("");
      setWithMeet(true);
      setLocation("");
      setMeetingTarget("lead");
      setSelectedLeadId("");
      setSelectedMemberIds(new Set());
    }
  }, [open, initialDate, today]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);

    startTransition(async () => {
      // ── Lead meeting → scheduleLeadMeeting (logs as interaction) ──────────
      if (kind === "google_meeting" && meetingTarget === "lead") {
        if (!selectedLeadId) {
          setError("Selecciona un lead");
          return;
        }
        const startISO = toISO(date, startTime);
        const endISO = toISO(date, endTime);
        const attendeeEmails = selectedLead?.email ? [selectedLead.email] : undefined;

        const res = await scheduleLeadMeeting({
          leadId: selectedLeadId,
          start: startISO,
          end: endISO,
          title: title.trim(),
          description: description || undefined,
          attendeeEmails,
          withMeet,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }

        onCreated({
          id: `google_meeting:${res.eventId}`,
          kind: "google_meeting",
          title: title.trim(),
          start: startISO,
          end: endISO,
          allDay: false,
          href: res.htmlLink ?? null,
          editable: false,
          done: false,
          memberId: null,
          memberName: null,
          meta: {
            meetUrl: res.meetUrl ?? undefined,
            htmlLink: res.htmlLink ?? undefined,
            description: description || undefined,
          },
        });
        onClose();
        return;
      }

      // ── Internal meeting / task / reminder ───────────────────────────────
      // Collect attendee emails from selected members (excluding current user — Google adds them automatically)
      const attendeeEmails =
        kind === "google_meeting" && meetingTarget === "internal" && selectedMemberIds.size > 0
          ? teamMembers
            .filter((m) => selectedMemberIds.has(m.id) && m.email)
            .map((m) => m.email as string)
          : undefined;

      const res = await createCalendarEvent({
        kind,
        title,
        date,
        startTime: kind !== "task" ? startTime : undefined,
        endTime: kind === "google_meeting" || kind === "event" ? endTime : undefined,
        description: description || undefined,
        assigneeId: kind === "task" && assigneeId ? assigneeId : undefined,
        withMeet: kind === "google_meeting" ? withMeet : undefined,
        attendeeEmails,
        location: kind === "event" ? location.trim() || undefined : undefined,
        attendeeMemberIds: kind === "event" ? Array.from(selectedMemberIds) : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated(res.event);
      onClose();
    });
  }

  const isLeadMeeting = kind === "google_meeting" && meetingTarget === "lead";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo evento</DialogTitle>
        </DialogHeader>

        {/* Type selector */}
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                kind === k.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {k.icon}
              <span className="text-xs font-medium">{k.label}</span>
              <span className="text-[10px] opacity-60">{k.desc}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-1">
          {/* Title */}
          <input
            required
            placeholder={
              kind === "task"
                ? "Nombre de la tarea…"
                : kind === "reminder"
                  ? "¿De qué quieres acordarte?"
                  : kind === "event"
                    ? "Nombre de la charla o evento…"
                    : isLeadMeeting && selectedLead
                      ? `Reunión con ${selectedLead.name}`
                      : "Asunto de la reunión…"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Date + time row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="ev-date" className={LABEL_CLS}>
                Fecha
              </label>
              <input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={cn(INPUT_CLS, "mt-0.5")}
              />
            </div>
            {kind !== "task" && (
              <div>
                <label htmlFor="ev-start" className={LABEL_CLS}>
                  Hora
                </label>
                <input
                  id="ev-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(INPUT_CLS, "mt-0.5")}
                />
              </div>
            )}
            {(kind === "google_meeting" || kind === "event") && (
              <div>
                <label htmlFor="ev-end" className={LABEL_CLS}>
                  Fin
                </label>
                <input
                  id="ev-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={cn(INPUT_CLS, "mt-0.5")}
                />
              </div>
            )}
          </div>

          {/* Event: location */}
          {kind === "event" && (
            <div>
              <label htmlFor="ev-location" className={LABEL_CLS}>
                Ubicación
              </label>
              <input
                id="ev-location"
                placeholder="Ej. Tecnocampus Mataró"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={cn(INPUT_CLS, "mt-0.5")}
              />
            </div>
          )}

          {/* Event: attendee selector */}
          {kind === "event" && teamMembers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>Asistentes</span>
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2">
                {teamMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer select-none items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.has(m.id)}
                      onChange={() =>
                        setSelectedMemberIds((prev) => {
                          const next = new Set(prev);
                          next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                          return next;
                        })
                      }
                      className="rounded"
                    />
                    <span className="flex-1">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Meeting: lead vs internal toggle */}
          {kind === "google_meeting" && (
            <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setMeetingTarget("lead")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors",
                  meetingTarget === "lead"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <Video className="size-3.5" />
                Con un lead
              </button>
              <button
                type="button"
                onClick={() => setMeetingTarget("internal")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors border-l border-border",
                  meetingTarget === "internal"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <Users className="size-3.5" />
                Interna
              </button>
            </div>
          )}

          {/* Internal member selector */}
          {kind === "google_meeting" && meetingTarget === "internal" && teamMembers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>Participantes</span>
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2">
                {teamMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer select-none items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.has(m.id)}
                      onChange={() =>
                        setSelectedMemberIds((prev) => {
                          const next = new Set(prev);
                          next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                          return next;
                        })
                      }
                      className="rounded"
                    />
                    <span className="flex-1">{m.name}</span>
                    {m.email && <span className="text-xs text-muted-foreground">{m.email}</span>}
                  </label>
                ))}
              </div>
              {selectedMemberIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  Se enviará invitación a {selectedMemberIds.size} compañero
                  {selectedMemberIds.size > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {/* Lead selector */}
          {kind === "google_meeting" && meetingTarget === "lead" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-lead" className={LABEL_CLS}>
                Lead
              </label>
              <EntityCombobox
                id="ev-lead"
                items={leads.map((l) => ({
                  id: l.id,
                  label: l.name,
                  sublabel: l.company,
                }))}
                value={selectedLeadId}
                onChange={(id) => {
                  setSelectedLeadId(id);
                  const lead = leads.find((l) => l.id === id);
                  if (lead && !title) setTitle(`Reunión con ${lead.name}`);
                }}
                placeholder="Buscar lead…"
              />
              {selectedLead?.email && (
                <p className="text-xs text-muted-foreground">
                  Se enviará invitación a <span className="font-medium">{selectedLead.email}</span>
                </p>
              )}
            </div>
          )}

          {/* Assignee (tasks, multi-member teams) */}
          {kind === "task" && teamMembers.length > 1 && (
            <div>
              <label htmlFor="ev-assignee" className={LABEL_CLS}>
                Asignado a
              </label>
              <select
                id="ev-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={cn(INPUT_CLS, "mt-0.5")}
              >
                <option value="">Yo mismo</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Meet toggle */}
          {kind === "google_meeting" && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withMeet}
                onChange={(e) => setWithMeet(e.target.checked)}
                className="rounded"
              />
              Crear enlace de Google Meet
            </label>
          )}

          {/* Notes */}
          <textarea
            placeholder="Notas (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !title.trim() || (isLeadMeeting && !selectedLeadId)}
            >
              {isPending ? "Guardando…" : isLeadMeeting ? "Registrar reunión" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
