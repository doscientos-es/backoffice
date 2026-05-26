"use client";

import { Badge } from "@/components/ui/badge";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { LostReasonDialog } from "./lost-reason-dialog";
import { LeadQuickView } from "./lead-quick-view";
import { cn, formatEUR, relativeTime } from "@/lib/utils";
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
import { AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { updateLeadStatus } from "./actions";
import { type FastLead, LeadFastActions } from "./lead-fast-actions";

export type KanbanLead = FastLead & {
  company: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  estimated_value: number | null;
};

type LeadStatus = "new" | "qualifying" | "quoted" | "won" | "lost" | "archived";

const STALE_DAYS = 3;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES: ReadonlySet<LeadStatus> = new Set(["won", "lost", "archived"]);

function isStale(lead: KanbanLead): boolean {
  if (TERMINAL_STATUSES.has(lead.status)) return false;
  return Date.now() - new Date(lead.updated_at).getTime() > STALE_MS;
}

function sumEstimated(leads: KanbanLead[]): number {
  return leads.reduce((acc, l) => acc + (l.estimated_value ?? 0), 0);
}

const COLUMNS: { id: LeadStatus; label: string; tone: string; dot: string }[] = [
  { id: "new", label: "Nuevo", tone: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  { id: "qualifying", label: "Cualificando", tone: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { id: "quoted", label: "Presupuestado", tone: "text-amber-700 dark:text-amber-300", dot: "bg-amber-400" },
  { id: "won", label: "Ganado", tone: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { id: "lost", label: "Perdido", tone: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  { id: "archived", label: "Archivado", tone: "text-muted-foreground", dot: "bg-muted-foreground/40" },
];

type Action = { id: string; status: LeadStatus };

export function LeadsKanban({
  leads,
  aiEnabled,
}: { leads: KanbanLead[]; aiEnabled: boolean }) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(leads, (state, { id, status }: Action) =>
    state.map((l) => (l.id === id ? { ...l, status } : l)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{ id: string; name: string } | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const feedback = useFormFeedback();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const commitMove = (id: string, to: LeadStatus, lostReason?: string) => {
    startTransition(async () => {
      applyOptimistic({ id, status: to });
      feedback.setPending();
      const res = await updateLeadStatus({ leadId: id, status: to, lostReason });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Estado actualizado");
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const to = String(e.over.id) as LeadStatus;
    const current = optimistic.find((l) => l.id === id);
    if (!current || current.status === to) return;

    if (to === "lost") {
      setPendingLost({ id, name: current.name });
      return;
    }
    commitMove(id, to);
  };

  const grouped: Record<LeadStatus, KanbanLead[]> = {
    new: [],
    qualifying: [],
    quoted: [],
    won: [],
    lost: [],
    archived: [],
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
          <Column
            key={col.id}
            status={col.id}
            label={col.label}
            tone={col.tone}
            dot={col.dot}
            leads={grouped[col.id]}
            aiEnabled={aiEnabled}
            onOpenQuickView={setQuickViewId}
          />
        ))}
      </div>
      <DragOverlay>{active ? <Card lead={active} aiEnabled={aiEnabled} isOverlay /> : null}</DragOverlay>
      <LostReasonDialog
        lead={pendingLost}
        onCancel={() => setPendingLost(null)}
        onConfirm={(reason) => {
          if (!pendingLost) return;
          commitMove(pendingLost.id, "lost", reason);
          setPendingLost(null);
        }}
      />
      <LeadQuickView
        lead={quickViewId ? (optimistic.find((l) => l.id === quickViewId) ?? null) : null}
        onClose={() => setQuickViewId(null)}
      />
    </DndContext>
  );
}

function Column({
  status,
  label,
  tone,
  dot,
  leads,
  aiEnabled,
  onOpenQuickView,
}: {
  status: LeadStatus;
  label: string;
  tone: string;
  dot: string;
  leads: KanbanLead[];
  aiEnabled: boolean;
  onOpenQuickView: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = sumEstimated(leads);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl bg-card ring-1 ring-foreground/10 transition-colors",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <header className="flex flex-col gap-1 px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full shrink-0", dot)} />
            <span className={cn("text-xs font-semibold tracking-wide", tone)}>{label}</span>
          </div>
          <Badge variant="neutral" className="tabular-nums text-[11px] h-5">
            {leads.length}
          </Badge>
        </div>
        {total > 0 && (
          <p className="pl-4 text-[11px] tabular-nums text-muted-foreground">{formatEUR(total)}</p>
        )}
      </header>
      <div className="flex flex-col gap-1.5 p-2 min-h-24">
        {leads.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Sin leads</p>
        ) : (
          leads.map((l) => (
            <Card key={l.id} lead={l} aiEnabled={aiEnabled} onOpenQuickView={onOpenQuickView} />
          ))
        )}
        {status === "new" && <AddLeadCard />}
      </div>
    </div>
  );
}

function AddLeadCard() {
  return (
    <Link
      href="/leads/new"
      className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
    >
      <Plus className="size-3.5 shrink-0" />
      Añadir lead
    </Link>
  );
}

function LeadInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2 ? (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "") : (parts[0]?.[0] ?? "?");
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold uppercase text-primary">
      {letters}
    </span>
  );
}

function Card({
  lead,
  aiEnabled,
  isOverlay = false,
  onOpenQuickView,
}: {
  lead: KanbanLead;
  aiEnabled: boolean;
  isOverlay?: boolean;
  onOpenQuickView?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const stale = isStale(lead);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpenQuickView ? () => onOpenQuickView(lead.id) : undefined}
      onKeyDown={
        onOpenQuickView
          ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenQuickView(lead.id);
            }
          }
          : undefined
      }
      role={onOpenQuickView ? "button" : undefined}
      tabIndex={onOpenQuickView ? 0 : undefined}
      className={cn(
        "group flex cursor-grab flex-col gap-2 rounded-lg bg-background p-3 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isDragging && "opacity-30",
        isOverlay && "cursor-grabbing shadow-lg ring-foreground/30",
        stale && !isOverlay && "ring-amber-400/60 dark:ring-amber-500/40",
      )}
    >
      <div className="flex items-start gap-2">
        <LeadInitials name={lead.name} />
        <Link
          href={`/leads/${lead.id}`}
          className="flex-1 truncate text-sm font-medium leading-tight hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        >
          {lead.name}
        </Link>
        {stale && !isOverlay && (
          <span
            title={`Sin cambios desde hace ${relativeTime(lead.updated_at)}`}
            aria-label="Lead estancado"
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          >
            <AlertTriangle className="size-2.5" aria-hidden />
          </span>
        )}
      </div>
      {(lead.company || lead.email) && (
        <div className="flex flex-col gap-0.5 pl-8">
          {lead.company && (
            <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
          )}
          {lead.email && (
            <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pl-8">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {relativeTime(lead.created_at)}
          </p>
          {lead.estimated_value != null && lead.estimated_value > 0 && (
            <Badge variant="neutral" className="tabular-nums text-[10px] h-4 px-1.5">
              {formatEUR(lead.estimated_value)}
            </Badge>
          )}
        </div>
        {!isOverlay && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <LeadFastActions lead={lead} aiEnabled={aiEnabled} />
          </div>
        )}
      </div>
    </div>
  );
}
