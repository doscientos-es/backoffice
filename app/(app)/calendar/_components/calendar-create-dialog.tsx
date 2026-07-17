"use client";

import { scheduleLeadMeeting } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { EntityMultiCombobox } from "@/components/ui/entity-multi-combobox";
import { createCalendarEvent } from "@/lib/calendar/actions";
import type { CalendarEvent } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";
import { Bell, CheckSquare, Presentation, Video } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { LeadOption, ProjectOption, TeamMember } from "./calendar-grid";

type Kind = "task" | "reminder" | "google_meeting" | "event";

type Props = {
  open: boolean;
  initialDate?: string;
  teamMembers: TeamMember[];
  leads: LeadOption[];
  projects: ProjectOption[];
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
  projects,
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

  // Meeting/Event state
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

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
      setSelectedLeadId("");
      setSelectedProjectId("");
      setSelectedMemberIds([]);
    }
  }, [open, initialDate, today]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        // Emails of the selected internal members (Google adds the organizer automatically).
        const memberEmails = teamMembers
          .filter((m) => selectedMemberIds.includes(m.id) && m.email)
          .map((m) => m.email as string);

        // ── Meeting with a lead → scheduleLeadMeeting (logs as interaction) ────
        if (kind === "google_meeting" && selectedLeadId) {
          const startISO = toISO(date, startTime);
          const endISO = toISO(date, endTime);
          const attendeeEmails = [
            ...(selectedLead?.email ? [selectedLead.email] : []),
            ...memberEmails,
          ];

          const res = await scheduleLeadMeeting({
            leadId: selectedLeadId,
            start: startISO,
            end: endISO,
            title: title.trim(),
            description: description || undefined,
            attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
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
        const attendeeEmails =
          kind === "google_meeting" && memberEmails.length > 0 ? memberEmails : undefined;

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
          attendeeMemberIds: kind === "event" ? selectedMemberIds : undefined,
          projectId: kind === "event" ? selectedProjectId || undefined : undefined,
          leadId: kind === "event" ? selectedLeadId || undefined : undefined,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onCreated(res.event);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ha ocurrido un error inesperado");
      }
    });
  }

  const hasLead = kind === "google_meeting" && !!selectedLeadId;

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
                    : kind === "google_meeting" && selectedLead
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

          {/* Event: optional project/lead */}
          {kind === "event" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ev-project" className={LABEL_CLS}>
                  Proyecto (opcional)
                </label>
                <EntityCombobox
                  id="ev-project"
                  items={projects.map((p) => ({ id: p.id, label: p.name }))}
                  value={selectedProjectId}
                  onChange={(id) => {
                    setSelectedProjectId(id);
                    if (id) setSelectedLeadId("");
                  }}
                  placeholder="Proyecto…"
                />
              </div>
              <div>
                <label htmlFor="ev-event-lead" className={LABEL_CLS}>
                  Lead (opcional)
                </label>
                <EntityCombobox
                  id="ev-event-lead"
                  items={leads.map((l) => ({ id: l.id, label: l.name, sublabel: l.company }))}
                  value={selectedLeadId}
                  onChange={(id) => {
                    setSelectedLeadId(id);
                    if (id) setSelectedProjectId("");
                  }}
                  placeholder="Lead…"
                />
              </div>
            </div>
          )}

          {/* Event: attendee selector via EntityMultiCombobox */}
          {kind === "event" && teamMembers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>Asistentes</span>
              <EntityMultiCombobox
                id="ev-attendees"
                items={teamMembers.map((m) => ({ id: m.id, label: m.name, sublabel: m.email }))}
                value={selectedMemberIds}
                onChange={setSelectedMemberIds}
                placeholder="Añadir asistentes…"
              />
            </div>
          )}

          {/* Meeting: internal participants (multi-select) */}
          {kind === "google_meeting" && teamMembers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-members" className={LABEL_CLS}>
                Participantes internos
              </label>
              <EntityMultiCombobox
                id="ev-members"
                items={teamMembers.map((m) => ({
                  id: m.id,
                  label: m.name,
                  sublabel: m.email,
                }))}
                value={selectedMemberIds}
                onChange={setSelectedMemberIds}
                placeholder="Añadir compañeros…"
              />
            </div>
          )}

          {/* Meeting: optional lead */}
          {kind === "google_meeting" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-lead" className={LABEL_CLS}>
                Lead (opcional)
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
              {selectedLead && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-foreground">
                  {selectedLead.email ? (
                    <>
                      Al crearla, se enviará una invitación real a{" "}
                      <span className="font-medium">{selectedLead.email}</span> y quedará registrada
                      como interacción.
                    </>
                  ) : (
                    "Quedará registrada como interacción en el lead."
                  )}
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
            <Button type="submit" size="sm" disabled={isPending || !title.trim()}>
              {isPending ? "Guardando…" : hasLead ? "Registrar reunión" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
