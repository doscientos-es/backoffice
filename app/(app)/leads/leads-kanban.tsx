"use client";

import { Badge } from "@/components/ui/badge";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { updateLeadStatus } from "./actions";

export type KanbanLead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: LeadStatus;
  created_at: string;
};

type LeadStatus = "new" | "qualifying" | "quoted" | "won" | "lost" | "archived";

const COLUMNS: { id: LeadStatus; label: string; tone: string }[] = [
  { id: "new", label: "Nuevo", tone: "text-sky-700 dark:text-sky-300" },
  { id: "qualifying", label: "En cualificación", tone: "text-amber-700 dark:text-amber-300" },
  { id: "quoted", label: "Presupuestado", tone: "text-amber-700 dark:text-amber-300" },
  { id: "won", label: "Ganado", tone: "text-emerald-700 dark:text-emerald-300" },
  { id: "lost", label: "Perdido", tone: "text-red-700 dark:text-red-300" },
  { id: "archived", label: "Archivado", tone: "text-muted-foreground" },
];

type Action = { id: string; status: LeadStatus };

export function LeadsKanban({ leads }: { leads: KanbanLead[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(leads, (state, { id, status }: Action) =>
    state.map((l) => (l.id === id ? { ...l, status } : l)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const feedback = useFormFeedback();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const to = String(e.over.id) as LeadStatus;
    const current = optimistic.find((l) => l.id === id);
    if (!current || current.status === to) return;

    startTransition(async () => {
      applyOptimistic({ id, status: to });
      feedback.setPending();
      const res = await updateLeadStatus({ leadId: id, status: to });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Estado actualizado");
    });
  };

  const grouped: Record<LeadStatus, KanbanLead[]> = {
    new: [], qualifying: [], quoted: [], won: [], lost: [], archived: [],
  };
  for (const l of optimistic) grouped[l.status]?.push(l);

  const active = activeId ? optimistic.find((l) => l.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex justify-end pb-1 min-h-5">
        <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => (
          <Column key={col.id} status={col.id} label={col.label} tone={col.tone} leads={grouped[col.id]} />
        ))}
      </div>
      <DragOverlay>{active ? <Card lead={active} isOverlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({
  status, label, tone, leads,
}: { status: LeadStatus; label: string; tone: string; leads: KanbanLead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl bg-card ring-1 ring-foreground/10 transition-colors",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className={cn("text-xs font-semibold uppercase tracking-wide", tone)}>{label}</span>
        <Badge variant="neutral" className="tabular-nums">{leads.length}</Badge>
      </header>
      <div className="flex flex-col gap-2 p-2 min-h-24">
        {leads.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">Sin leads.</p>
        ) : (
          leads.map((l) => <Card key={l.id} lead={l} />)
        )}
      </div>
    </div>
  );
}

function Card({ lead, isOverlay = false }: { lead: KanbanLead; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex cursor-grab flex-col gap-1 rounded-lg bg-background p-2.5 text-left ring-1 ring-border transition-shadow hover:ring-foreground/20",
        isDragging && "opacity-30",
        isOverlay && "cursor-grabbing shadow-lg ring-foreground/30",
      )}
    >
      <Link
        href={`/leads/${lead.id}`}
        className="truncate text-sm font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      >
        {lead.name}
      </Link>
      {lead.company ? (
        <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
      ) : null}
      {lead.email ? (
        <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
      ) : null}
    </div>
  );
}
