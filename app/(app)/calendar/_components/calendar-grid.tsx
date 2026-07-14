"use client";

import { ErrorBoundary } from "@/components/ui/error-boundary";
import { rescheduleEvent } from "@/lib/calendar/actions";
import {
  ALL_LAYERS,
  CALENDAR_LAYER_COLORS,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarView,
} from "@/lib/calendar/types";
import { cn } from "@/lib/utils";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { CalendarCreateDialog } from "./calendar-create-dialog";
import { CalendarEventDialog } from "./calendar-event-dialog";
import { CalendarHeader } from "./calendar-header";
import { DayCell } from "./day-cell";

// Context so EventChip/DayCell can open the detail dialog without prop drilling
const CalendarDialogContext = createContext<(e: CalendarEvent) => void>(() => undefined);
export function useCalendarDialog() {
  return useContext(CalendarDialogContext);
}

// Context so DayCell day-number can open the create dialog with a pre-selected date
const CalendarCreateContext = createContext<(date?: string) => void>(() => undefined);
export function useCalendarCreate() {
  return useContext(CalendarCreateContext);
}

export type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  github_handle: string | null;
};

export type LeadOption = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

export type ProjectOption = {
  id: string;
  name: string;
};

type Props = {
  events: CalendarEvent[];
  view: CalendarView;
  anchor: string;
  teamMembers: TeamMember[];
  leads: LeadOption[];
  projects: ProjectOption[];
  prevMonth: string;
  nextMonth: string;
  calendarToken: string | null;
};

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function buildMonthGrid(anchor: Date): Date[][] {
  const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1), {
    weekStartsOn: 1,
  });
  const end = endOfWeek(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0), {
    weekStartsOn: 1,
  });
  const days = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function buildWeekGrid(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function groupByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const key = e.start.slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

export function CalendarGrid({
  events: initial,
  view,
  anchor,
  teamMembers,
  leads,
  projects,
  prevMonth,
  nextMonth,
  calendarToken,
}: Props) {
  const anchorDate = parseISO(anchor);
  const [, startTransition] = useTransition();
  const [events, applyOptimistic] = useOptimistic(
    initial,
    (state, { id, newStart }: { id: string; newStart: string }) =>
      state.map((e) => (e.id === id ? { ...e, start: newStart, end: newStart } : e)),
  );

  // ── Detail dialog ─────────────────────────────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // ── Create dialog ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);
  const [createdEvents, setCreatedEvents] = useState<CalendarEvent[]>([]);

  function openCreate(date?: string) {
    setCreateDate(date);
    setCreateOpen(true);
  }

  // ── Client-side filters ───────────────────────────────────────────────────
  const [activeLayers, setActiveLayers] = useState<Set<CalendarEventKind>>(new Set(ALL_LAYERS));
  const [activeMembers, setActiveMembers] = useState<Set<string>>(
    new Set(teamMembers.map((m) => m.id)),
  );

  function toggleLayer(layer: CalendarEventKind) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  function toggleMember(id: string) {
    setActiveMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Merge server events + locally-created optimistic events
  const allEvents = [...events, ...createdEvents];

  // Filter: by active layer AND member scope. Single-owner events use memberId;
  // shared events (charlas/eventos) use memberIds — visible if any attendee is active.
  const filtered = allEvents.filter((e) => {
    if (!activeLayers.has(e.kind)) return false;
    if (e.memberIds && e.memberIds.length > 0) {
      return e.memberIds.some((id) => activeMembers.has(id));
    }
    return e.memberId === null || activeMembers.has(e.memberId);
  });

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const event = events.find((e) => e.id === active.id);
    if (!event?.editable) return;
    const newStart = over.id as string;
    const parts = (event.id as string).split(":");
    const kind = parts[0] as CalendarEventKind;
    const sourceId = parts.slice(1).join(":");
    startTransition(async () => {
      applyOptimistic({ id: event.id, newStart });
      await rescheduleEvent({ kind, sourceId, newStart });
    });
  }

  const headerProps = {
    anchor,
    view,
    prevMonth,
    nextMonth,
    teamMembers,
    activeLayers,
    onToggleLayer: toggleLayer,
    activeMembers,
    onToggleMember: toggleMember,
    calendarToken,
  };

  // Shared dialogs + create button rendered once, shared across all views
  const sharedDialogs = (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border border-destructive/30 bg-background p-4 shadow-lg">
          <p className="text-sm font-medium text-destructive">Error en el diálogo</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{err.message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-xs underline text-muted-foreground hover:text-foreground"
          >
            Reintentar
          </button>
        </div>
      )}
    >
      <CalendarEventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      <CalendarCreateDialog
        open={createOpen}
        initialDate={createDate}
        teamMembers={teamMembers}
        leads={leads}
        projects={projects}
        onClose={() => setCreateOpen(false)}
        onCreated={(ev) => setCreatedEvents((prev) => [...prev, ev])}
      />
    </ErrorBoundary>
  );

  if (view === "agenda") {
    return (
      <CalendarDialogContext.Provider value={setSelectedEvent}>
        <CalendarCreateContext.Provider value={openCreate}>
          {sharedDialogs}
          <div className="flex flex-col h-full">
            <CalendarHeader {...headerProps} />
            <AgendaView events={filtered} />
          </div>
        </CalendarCreateContext.Provider>
      </CalendarDialogContext.Provider>
    );
  }

  if (view === "week") {
    const days = buildWeekGrid(anchorDate);
    return (
      <CalendarDialogContext.Provider value={setSelectedEvent}>
        <CalendarCreateContext.Provider value={openCreate}>
          {sharedDialogs}
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex flex-col h-full">
              <CalendarHeader {...headerProps} />
              <div className="grid grid-cols-7 border-b border-border text-center">
                {days.map((d) => (
                  <div
                    key={d.toISOString()}
                    className="py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {format(d, "EEE d", { locale: es })}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 flex-1 overflow-y-auto divide-x divide-border">
                {days.map((d) => (
                  <DayCell
                    key={d.toISOString()}
                    day={d}
                    events={filtered.filter((e) => isSameDay(parseISO(e.start), d))}
                    isCurrentMonth
                    isToday={isToday(d)}
                  />
                ))}
              </div>
            </div>
          </DndContext>
        </CalendarCreateContext.Provider>
      </CalendarDialogContext.Provider>
    );
  }

  // Month view (default)
  const weeks = buildMonthGrid(anchorDate);
  return (
    <CalendarDialogContext.Provider value={setSelectedEvent}>
      <CalendarCreateContext.Provider value={openCreate}>
        {sharedDialogs}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex flex-col h-full">
            <CalendarHeader {...headerProps} />
            <div className="grid grid-cols-7 border-b border-border">
              {WEEK_DAYS.map((d) => (
                <div
                  key={d}
                  className="py-1.5 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 grid-rows-[repeat(6,1fr)] divide-x divide-y divide-border overflow-hidden">
              {weeks.flatMap((week) =>
                week.map((d) => (
                  <DayCell
                    key={d.toISOString()}
                    day={d}
                    events={filtered.filter((e) => isSameDay(parseISO(e.start), d))}
                    isCurrentMonth={isSameMonth(d, anchorDate)}
                    isToday={isToday(d)}
                  />
                )),
              )}
            </div>
          </div>
        </DndContext>
      </CalendarCreateContext.Provider>
    </CalendarDialogContext.Provider>
  );
}

// ─── Agenda view ─────────────────────────────────────────────────────────────

function AgendaView({ events }: { events: CalendarEvent[] }) {
  const groups = groupByDate(events);
  const dates = Object.keys(groups).sort();
  if (!dates.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Sin eventos en este período
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto divide-y divide-border">
      {dates.map((date) => (
        <div key={date} className="flex gap-4 px-4 py-3">
          <div className="w-24 shrink-0 text-sm font-medium text-muted-foreground pt-0.5">
            {format(parseISO(date), "EEE d MMM", { locale: es })}
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {(groups[date] ?? []).map((e) => (
              <EventChip key={e.id} event={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EventChip ───────────────────────────────────────────────────────────────

export function EventChip({ event }: { event: CalendarEvent }) {
  const openDialog = useCalendarDialog();
  const colors = CALENDAR_LAYER_COLORS[event.kind];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openDialog(event);
      }}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium truncate transition-opacity text-left",
        "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        colors.bg,
        colors.text,
        event.done && "opacity-50",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
      <span className={cn("truncate", event.done && "line-through")}>{event.title}</span>
      {event.meta.projectName && !event.done && (
        <span className="shrink-0 opacity-60">· {event.meta.projectName}</span>
      )}
      {event.meta.clientName && !event.meta.projectName && (
        <span className="shrink-0 opacity-60">· {event.meta.clientName}</span>
      )}
    </button>
  );
}
