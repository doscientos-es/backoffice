"use client";

import { Badge } from "@/components/ui/badge";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { MemberAvatar } from "@/components/ui/member-avatar";
import type { LeadListItem } from "@/lib/leads/types";
import type { LeadStatus } from "@/lib/status";
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
import { AlertTriangle, PanelRightOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { updateLeadStatus } from "./actions";
import { CloseReasonDialog, type CloseReasonVariant } from "./close-reason-dialog";
import { LeadQuickView } from "./lead-quick-view";
import { QuotedSuggestionDialog } from "./quoted-suggestion-dialog";
import { ReopenConfirmDialog } from "./reopen-confirm-dialog";

export type KanbanLead = LeadListItem;

const STALE_DAYS = 3;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES: ReadonlySet<LeadStatus> = new Set([
  "won",
  "lost",
  "not_interested",
  "archived",
]);

// Active stages a won lead can be reopened into (excludes terminal statuses)
const REOPEN_INTO: ReadonlySet<LeadStatus> = new Set(["new", "qualifying", "quoted"]);

function isStale(lead: KanbanLead): boolean {
  if (TERMINAL_STATUSES.has(lead.status)) return false;
  return Date.now() - new Date(lead.updated_at).getTime() > STALE_MS;
}

function sumEstimated(leads: KanbanLead[]): number {
  return leads.reduce((acc, l) => acc + (l.estimated_value ?? 0), 0);
}

// `compact` columns rinden estrechas por defecto y se expanden al pasar por
// encima con un drag (o con el ratón). Útil para estados terminales o de
// baja prioridad que no merecen ocupar ancho de pipeline activo.
type ColumnDef = {
  id: LeadStatus;
  label: string;
  tone: string;
  dot: string;
  compact?: boolean;
};

const COLUMNS: ColumnDef[] = [
  { id: "new", label: "Nuevo", tone: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  {
    id: "qualifying",
    label: "Cualificando",
    tone: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    id: "quoted",
    label: "Presupuestado",
    tone: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-400",
  },
  {
    id: "won",
    label: "Ganado",
    tone: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    id: "lost",
    label: "Perdido",
    tone: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
    compact: true,
  },
  {
    id: "not_interested",
    label: "No interesa",
    tone: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-400",
    compact: true,
  },
  {
    id: "archived",
    label: "Archivado",
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
    compact: true,
  },
];

type Action = { id: string; status: LeadStatus };

export function LeadsKanban({
  leads,
  canEdit = false,
}: {
  leads: KanbanLead[];
  canEdit?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(leads, (state, { id, status }: Action) =>
    state.map((l) => (l.id === id ? { ...l, status } : l)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingClosure, setPendingClosure] = useState<{
    id: string;
    name: string;
    variant: CloseReasonVariant;
  } | null>(null);
  const [pendingReopen, setPendingReopen] = useState<{
    id: string;
    name: string;
    to: LeadStatus;
  } | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    id: string;
    name: string;
  } | null>(null);
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

    if (to === "lost" || to === "not_interested") {
      setPendingClosure({ id, name: current.name, variant: to });
      return;
    }

    // Reopening a won lead: ask for confirmation before committing
    if (current.status === "won" && REOPEN_INTO.has(to)) {
      setPendingReopen({ id, name: current.name, to });
      return;
    }

    commitMove(id, to);

    // After moving to quoted: suggest creating a proposal
    if (to === "quoted") {
      setPendingSuggestion({ id, name: current.name });
    }
  };

  const grouped: Record<LeadStatus, KanbanLead[]> = {
    new: [],
    qualifying: [],
    quoted: [],
    won: [],
    lost: [],
    not_interested: [],
    archived: [],
  };
  for (const l of optimistic) grouped[l.status]?.push(l);

  const active = activeId ? optimistic.find((l) => l.id === activeId) : null;
  const isDragging = activeId !== null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex justify-end pb-1 min-h-5">
        <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 h-[calc(100dvh-11rem)] min-h-[28rem]">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            status={col.id}
            label={col.label}
            tone={col.tone}
            dot={col.dot}
            compact={col.compact === true}
            isDragging={isDragging}
            leads={grouped[col.id]}
            onOpenQuickView={setQuickViewId}
          />
        ))}
      </div>
      <DragOverlay>{active ? <Card lead={active} isOverlay /> : null}</DragOverlay>
      <CloseReasonDialog
        lead={pendingClosure ? { id: pendingClosure.id, name: pendingClosure.name } : null}
        variant={pendingClosure?.variant ?? "lost"}
        onCancel={() => setPendingClosure(null)}
        onConfirm={(reason) => {
          if (!pendingClosure) return;
          const { id, variant } = pendingClosure;
          setPendingClosure(null);
          commitMove(id, variant, reason);
        }}
      />
      <ReopenConfirmDialog
        lead={pendingReopen ? { id: pendingReopen.id, name: pendingReopen.name } : null}
        onCancel={() => setPendingReopen(null)}
        onConfirm={() => {
          if (!pendingReopen) return;
          const { id, to } = pendingReopen;
          setPendingReopen(null);
          commitMove(id, to);
        }}
      />
      <QuotedSuggestionDialog lead={pendingSuggestion} onClose={() => setPendingSuggestion(null)} />
      <LeadQuickView
        lead={quickViewId ? (optimistic.find((l) => l.id === quickViewId) ?? null) : null}
        canEdit={canEdit}
        onCloseAction={() => setQuickViewId(null)}
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
  onOpenQuickView,
  compact = false,
  isDragging = false,
}: {
  status: LeadStatus;
  label: string;
  tone: string;
  dot: string;
  leads: KanbanLead[];
  onOpenQuickView: (id: string) => void;
  compact?: boolean;
  isDragging?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [pinned, setPinned] = useState(false);
  const total = sumEstimated(leads);
  // Estado lógico de colapso: solo aplica a columnas `compact` cuando el
  // usuario no las ha fijado (`pinned`) y no hay drag encima (`isOver`).
  // El comportamiento responsive se delega a Tailwind con prefijos `md:`,
  // de modo que en < md la columna siempre se renderiza expandida.
  const collapsed = compact && !isOver && !pinned;
  const dropHint = compact && isDragging && !isOver;
  const togglePin = compact ? () => setPinned((p) => !p) : undefined;
  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={`${label} · ${leads.length} lead${leads.length === 1 ? "" : "s"}`}
      title={
        collapsed
          ? `${label} (${leads.length}) · click para fijar`
          : pinned
            ? "Click en la cabecera para colapsar"
            : undefined
      }
      className={cn(
        "group/col relative flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        "transition-[width,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        collapsed && "md:w-11 md:cursor-pointer md:bg-muted/30 md:hover:w-72 md:hover:bg-card",
        isOver && "bg-primary/5 ring-2 ring-primary/50",
        dropHint && !isOver && "ring-dashed ring-primary/30",
      )}
    >
      <header
        onClick={togglePin}
        onKeyDown={(e) => {
          if (!togglePin) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            togglePin();
          }
        }}
        role={togglePin ? "button" : undefined}
        tabIndex={togglePin ? 0 : undefined}
        aria-pressed={togglePin ? pinned : undefined}
        className={cn(
          "flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          compact && "select-none",
          collapsed &&
            "md:items-center md:gap-2 md:px-1.5 md:group-hover/col:flex-row md:group-hover/col:items-center md:group-hover/col:justify-between md:group-hover/col:gap-1 md:group-hover/col:px-3",
        )}
      >
        <div
          className={cn(
            "flex flex-1 min-w-0 items-center gap-2",
            collapsed && "md:flex-col md:group-hover/col:flex-row",
          )}
        >
          <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
          <span
            className={cn(
              "truncate text-xs font-semibold tracking-wide",
              tone,
              collapsed &&
                "md:rotate-180 md:[writing-mode:vertical-rl] md:group-hover/col:rotate-0 md:group-hover/col:[writing-mode:horizontal-tb]",
            )}
          >
            {label}
          </span>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-2",
            collapsed && "md:justify-center md:group-hover/col:justify-between",
          )}
        >
          {total > 0 && (
            <p
              className={cn(
                "pl-4 text-[11px] tabular-nums text-muted-foreground",
                collapsed && "md:hidden md:group-hover/col:block",
              )}
            >
              {formatEUR(total)}
            </p>
          )}
          <Badge variant="neutral" className="ml-auto h-5 text-[11px] tabular-nums">
            {leads.length}
          </Badge>
        </div>
      </header>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2",
          collapsed && "md:hidden md:group-hover/col:flex",
        )}
      >
        {leads.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {dropHint ? "Soltar aquí" : "Sin leads"}
          </p>
        ) : (
          leads.map((l) => <Card key={l.id} lead={l} onOpenQuickView={onOpenQuickView} />)
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
  const letters =
    parts.length >= 2 ? (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "") : (parts[0]?.[0] ?? "?");
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold uppercase text-primary">
      {letters}
    </span>
  );
}

function Card({
  lead,
  isOverlay = false,
  onOpenQuickView,
}: {
  lead: KanbanLead;
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
      aria-label={onOpenQuickView ? `Abrir panel rápido de ${lead.name}` : undefined}
      title={onOpenQuickView ? "Abrir panel rápido" : undefined}
      className={cn(
        "group flex cursor-grab flex-col gap-2 rounded-lg bg-background p-3 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isDragging && "opacity-30",
        isOverlay && "cursor-grabbing shadow-lg ring-foreground/30",
        stale && !isOverlay && "ring-amber-400/60 dark:ring-amber-500/40",
      )}
    >
      <div className="flex items-start gap-2">
        <LeadInitials name={lead.name} />
        <span className="flex-1 truncate text-sm font-medium leading-tight">{lead.name}</span>
        {stale && !isOverlay && (
          <span
            title={`Sin cambios desde hace ${relativeTime(lead.updated_at)}`}
            aria-label="Lead estancado"
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          >
            <AlertTriangle className="size-2.5" aria-hidden />
          </span>
        )}
        {!isOverlay && onOpenQuickView && (
          <PanelRightOpen
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        )}
      </div>
      {(lead.company || lead.email) && (
        <div className="flex flex-col gap-0.5 pl-8">
          {lead.company && <p className="truncate text-xs text-muted-foreground">{lead.company}</p>}
          {lead.email && <p className="truncate text-xs text-muted-foreground">{lead.email}</p>}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pl-8 text-[11px] tabular-nums text-muted-foreground">
        <span className="whitespace-nowrap">{relativeTime(lead.created_at)}</span>
        <div className="flex items-center gap-1.5">
          {lead.estimated_value != null && lead.estimated_value > 0 && (
            <Badge variant="neutral" className="tabular-nums text-[10px] h-4 px-1.5">
              {formatEUR(lead.estimated_value)}
            </Badge>
          )}
          {lead.assignee ? (
            <MemberAvatar member={lead.assignee} size="sm" className="size-5" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
