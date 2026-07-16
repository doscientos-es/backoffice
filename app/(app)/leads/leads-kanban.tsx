"use client";

import { Badge } from "@/components/ui/badge";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { MemberAvatar } from "@/components/ui/member-avatar";
import type { LeadListItem } from "@/lib/leads/types";
import { getLeadInitials, leadDisplayName } from "@/lib/leads/utils";
import type { MemberOption } from "@/lib/members/queries";
import type { LeadStatus } from "@/lib/status";
import { cn, formatEUR, relativeTime } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  GripVertical,
  Mail,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { deleteLead, updateLeadStatus } from "./actions";
import { CloseReasonDialog, type CloseReasonVariant } from "./close-reason-dialog";
import { LeadQuickView } from "./lead-quick-view";
import { QuotedSuggestionDialog } from "./quoted-suggestion-dialog";
import { ReopenConfirmDialog } from "./reopen-confirm-dialog";

export type KanbanLead = LeadListItem;

const STALE_DAYS = 3;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

const URGENCY_STYLE: Record<string, string> = {
  Inmediata: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  "Este mes": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Este trimestre": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  "Sin urgencia": "bg-muted text-muted-foreground",
};
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
  {
    id: "new",
    label: "Nuevo",
    tone: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
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

// Columnas `compact` por defecto (antes de leer la preferencia persistida).
const DEFAULT_COMPACT_COLUMNS: LeadStatus[] = COLUMNS.filter((c) => c.compact).map((c) => c.id);
const COMPACT_COLUMNS_KEY = "leads-kanban:compact-columns";

function loadColumnSet(key: string): Set<LeadStatus> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as LeadStatus[]) : null;
  } catch {
    return null;
  }
}

function saveColumnSet(key: string, value: ReadonlySet<LeadStatus>) {
  try {
    localStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena…): la
    // preferencia simplemente no persiste entre sesiones.
  }
}

type Action = { type: "move"; id: string; status: LeadStatus } | { type: "remove"; id: string };

export function LeadsKanban({
  leads,
  canEdit = false,
  members = [],
}: {
  leads: KanbanLead[];
  canEdit?: boolean;
  members?: MemberOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());
  const [optimistic, applyOptimistic] = useOptimistic(leads, (state, action: Action) =>
    action.type === "remove"
      ? state.filter((l) => l.id !== action.id)
      : state.map((l) => (l.id === action.id ? { ...l, status: action.status } : l)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  // Columnas en modo compacto: se colapsan cuando no están bajo hover.
  // Cualquier columna puede activarlo, no solo las de estado terminal; la
  // preferencia persiste en localStorage.
  const [compactColumns, setCompactColumns] = useState<ReadonlySet<LeadStatus>>(
    () => new Set(DEFAULT_COMPACT_COLUMNS),
  );

  // Lee las preferencias persistidas tras el montaje: el servidor siempre
  // renderiza el set por defecto, así que aplicar esto antes provocaría un
  // mismatch de hidratación.
  useEffect(() => {
    const storedCompact = loadColumnSet(COMPACT_COLUMNS_KEY);
    if (storedCompact) setCompactColumns(storedCompact);
  }, []);

  const toggleColumnCompact = (id: LeadStatus) => {
    const wasCompact = compactColumns.has(id);
    setCompactColumns((prev) => {
      const next = new Set(prev);
      if (wasCompact) next.delete(id);
      else next.add(id);
      saveColumnSet(COMPACT_COLUMNS_KEY, next);
      return next;
    });
  };

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
      setLastRefresh(new Date());
    });
  };
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const commitMove = (id: string, to: LeadStatus, lostReason?: string) => {
    startTransition(async () => {
      applyOptimistic({ type: "move", id, status: to });
      feedback.setPending();
      const res = await updateLeadStatus({
        leadId: id,
        status: to,
        lostReason,
      });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Estado actualizado");
    });
  };

  // Optimistically drops the card from the board; the server revalidation keeps
  // it gone on success, and on failure React reverts the state (the card
  // reappears) with an error shown in the feedback bar.
  const commitDelete = (id: string) => {
    setQuickViewId(null);
    startTransition(async () => {
      applyOptimistic({ type: "remove", id });
      feedback.setPending();
      const res = await deleteLead({ id });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Lead eliminado");
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
      setPendingClosure({ id, name: leadDisplayName(current), variant: to });
      return;
    }

    // Reopening a won lead: ask for confirmation before committing
    if (current.status === "won" && REOPEN_INTO.has(to)) {
      setPendingReopen({ id, name: leadDisplayName(current), to });
      return;
    }

    commitMove(id, to);

    // After moving to quoted: suggest creating a proposal
    if (to === "quoted") {
      setPendingSuggestion({ id, name: leadDisplayName(current) });
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
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex items-center justify-between pb-1 min-h-5">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Actualizar leads"
        >
          <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
          <span>
            {isRefreshing
              ? "Actualizando…"
              : `Actualizado ${relativeTime(lastRefresh.toISOString())}`}
          </span>
        </button>
        <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 h-[calc(100dvh-11rem)] min-h-[28rem] scroll-fade-x no-scrollbar">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            status={col.id}
            label={col.label}
            tone={col.tone}
            dot={col.dot}
            compact={compactColumns.has(col.id)}
            isDragging={isDragging}
            leads={grouped[col.id]}
            canEdit={canEdit}
            onOpenQuickView={setQuickViewId}
            onToggleCompact={() => toggleColumnCompact(col.id)}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? <Card lead={active} isOverlay canEdit={canEdit} /> : null}
      </DragOverlay>
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
        members={members}
        onDeleteAction={commitDelete}
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
  canEdit = false,
  onOpenQuickView,
  compact = false,
  isDragging = false,
  onToggleCompact,
}: {
  status: LeadStatus;
  label: string;
  tone: string;
  dot: string;
  leads: KanbanLead[];
  canEdit?: boolean;
  onOpenQuickView: (id: string) => void;
  compact?: boolean;
  isDragging?: boolean;
  onToggleCompact: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = sumEstimated(leads);
  // Las columnas compactas se expanden durante hover para facilitar la
  // revisión y vuelven a colapsarse al salir el cursor.
  // El comportamiento responsive se delega a Tailwind con prefijos `md:`,
  // de modo que en < md la columna siempre se renderiza expandida.
  const collapsed = compact && !isOver;
  const dropHint = compact && isDragging && !isOver;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} · ${leads.length} lead${leads.length === 1 ? "" : "s"}`}
      title={collapsed ? `${label} (${leads.length}) · pasa el cursor para expandir` : undefined}
      className={cn(
        "group/col relative flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        "transition-[width,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        collapsed && "md:w-11 md:cursor-pointer md:bg-muted/30 md:hover:w-72 md:hover:bg-card",
        isOver && "bg-primary/5 ring-2 ring-primary/50",
        dropHint && !isOver && "ring-dashed ring-primary/30",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2.5",
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompact();
            }}
            title={compact ? "Mantener siempre visible" : "Colapsar cuando no esté en uso"}
            aria-label={compact ? "Mantener siempre visible" : "Colapsar cuando no esté en uso"}
            className={cn(
              "shrink-0 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity",
              "hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/col:opacity-100",
              collapsed && "md:hidden md:group-hover/col:inline-flex",
            )}
          >
            {compact ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
          </button>
          <Badge variant="neutral" className="ml-auto h-5 text-[11px] tabular-nums">
            {leads.length}
          </Badge>
        </div>
      </header>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2 scroll-fade no-scrollbar",
          collapsed && "md:hidden md:group-hover/col:flex",
        )}
      >
        {leads.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {dropHint ? "Soltar aquí" : "Sin leads"}
          </p>
        ) : (
          leads.map((l) => <Card key={l.id} lead={l} canEdit={canEdit} onOpenQuickView={onOpenQuickView} />)
        )}
        {status === "new" && <AddLeadCard />}
      </div>
    </section>
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

function LeadInitials({ lead }: { lead: KanbanLead }) {
  const letters = getLeadInitials(lead);
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold uppercase text-primary">
      {letters}
    </span>
  );
}

function Card({
  lead,
  isOverlay = false,
  canEdit = false,
  onOpenQuickView,
}: {
  lead: KanbanLead;
  isOverlay?: boolean;
  canEdit?: boolean;
  onOpenQuickView?: (id: string) => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: !canEdit || isOverlay,
  });
  const stale = isStale(lead);
  return (
    <article
      ref={setNodeRef}
      className={cn(
        "group flex flex-col gap-2 rounded-lg bg-background p-3 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-foreground/20",
        isDragging && "opacity-30",
        isOverlay && "cursor-grabbing shadow-lg ring-foreground/30",
        stale && !isOverlay && "ring-amber-400/60 dark:ring-amber-500/40",
      )}
    >
      <div className="flex items-start gap-2">
        {canEdit ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Arrastrar ${leadDisplayName(lead)}`}
            title="Arrastrar lead"
            className="mt-0.5 shrink-0 cursor-grab touch-none rounded text-muted-foreground/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        ) : null}
        <LeadInitials lead={lead} />
        <div className="min-w-0 flex-1">
          {onOpenQuickView ? (
            <button
              type="button"
              onClick={() => onOpenQuickView(lead.id)}
              className="block max-w-full truncate text-left text-sm font-medium leading-tight underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              title="Abrir panel rápido"
            >
              {leadDisplayName(lead)}
            </button>
          ) : (
            <span className="block truncate text-sm font-medium leading-tight">
              {leadDisplayName(lead)}
            </span>
          )}
          {lead.alias?.trim() && lead.alias.trim() !== lead.name ? (
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{lead.name}</p>
          ) : null}
        </div>
        {stale && !isOverlay && (
          <span
            aria-label="Lead estancado: necesita seguimiento"
            title={`Sin cambios ${relativeTime(lead.updated_at)}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          >
            <AlertTriangle className="size-2.5" aria-hidden />
          </span>
        )}
      </div>
      {(lead.company || lead.phone || lead.email) && (
        <div className="flex min-w-0 flex-col gap-0.5 pl-8 text-xs">
          {lead.company ? <p className="truncate text-muted-foreground">{lead.company}</p> : null}
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              aria-label={`Llamar a ${leadDisplayName(lead)}`}
              className="inline-flex min-w-0 items-center gap-1 truncate text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Phone className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{lead.phone}</span>
            </a>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              aria-label={`Enviar email a ${leadDisplayName(lead)}`}
              className="inline-flex min-w-0 items-center gap-1 truncate text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Mail className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{lead.email}</span>
            </a>
          ) : null}
        </div>
      )}
      {lead.urgency && (
        <div className="flex flex-wrap items-center gap-1 pl-8">
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
              URGENCY_STYLE[lead.urgency] ?? "bg-muted text-muted-foreground",
            )}
          >
            {lead.urgency}
          </span>
        </div>
      )}
      {lead.status === "lost" && lead.lost_reason ? (
        <p
          className="truncate pl-8 text-[11px] text-destructive/75"
          title={`Motivo de pérdida: ${lead.lost_reason}`}
        >
          <span className="font-medium">Pérdida:</span> {lead.lost_reason}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-1.5 pl-8">
        <div className="flex items-center gap-1.5">
          {lead.score != null && (
            <Badge variant="neutral" className="tabular-nums text-[10px] h-4 px-1.5">
              {lead.score}
            </Badge>
          )}
          {lead.estimated_value != null && lead.estimated_value > 0 && (
            <Badge variant="neutral" className="tabular-nums text-[10px] h-4 px-1.5">
              {formatEUR(lead.estimated_value)}
            </Badge>
          )}
        </div>
        {lead.assignee ? (
          <MemberAvatar member={lead.assignee} size="sm" className="size-5 shrink-0" />
        ) : null}
      </div>
    </article>
  );
}
