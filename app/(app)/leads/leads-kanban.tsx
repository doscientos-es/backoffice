"use client";

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
  CalendarClock,
  CalendarPlus,
  Filter,
  GripVertical,
  History as HistoryIcon,
  Hourglass,
  Mail,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  RefreshCw,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  boardColumnFor,
  isRotting,
  nextActionRank,
  nextActionState,
  STAGE_ROT_DAYS,
  waitingForReplySince,
} from "@/lib/leads/pipeline";
import type { LeadListItem, LeadMemberRef } from "@/lib/leads/types";
import { leadDisplayName } from "@/lib/leads/utils";
import type { MemberOption } from "@/lib/members/queries";
import type { LeadStatus } from "@/lib/status";
import { cn, formatEUR, relativeTime } from "@/lib/utils";
import { ScheduleReminderDialog } from "../reminders/schedule-reminder-dialog";
import { deleteLead, updateLeadStatus } from "./actions";
import { CloseReasonDialog, type CloseReasonVariant } from "./close-reason-dialog";
import { LeadQuickView } from "./lead-quick-view";
import { QuotedSuggestionDialog } from "./quoted-suggestion-dialog";
import { ReopenConfirmDialog } from "./reopen-confirm-dialog";

const URGENCY_STYLE: Record<string, string> = {
  Inmediata: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  "Este mes": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Este trimestre": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  "Sin urgencia": "bg-muted text-muted-foreground",
};

// Active stages a won lead can be reopened into (excludes terminal statuses)
const REOPEN_INTO: ReadonlySet<LeadStatus> = new Set([
  "new",
  "contacted",
  "in_conversation",
  "quoted",
]);

/** Prefilled reminder title when a move leaves the lead without a next step. */
const NEXT_ACTION_SUGGESTION: Partial<Record<LeadStatus, string>> = {
  new: "Contactar con",
  contacted: "Hacer seguimiento a",
  in_conversation: "Continuar la conversación con",
  quoted: "Seguimiento del presupuesto de",
};

function sumEstimated(leads: KanbanLead[]): number {
  return leads.reduce((acc, l) => acc + (l.estimated_value ?? 0), 0);
}

/**
 * Orders a column by risk: overdue first, then leads with nothing scheduled,
 * then by due date. Ties fall back to the oldest update, so forgotten cards
 * never hide at the bottom.
 */
function compareByUrgency(a: KanbanLead, b: KanbanLead): number {
  const rankA = nextActionRank(nextActionState(a.status, a.next_action));
  const rankB = nextActionRank(nextActionState(b.status, b.next_action));
  if (rankA !== rankB) return rankA - rankB;
  const dueA = a.next_action ? new Date(a.next_action.remind_at).getTime() : 0;
  const dueB = b.next_action ? new Date(b.next_action.remind_at).getTime() : 0;
  if (dueA !== dueB) return dueA - dueB;
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}

/** Cards a rep should act on right now: overdue or with no next step at all. */
function countNeedingAttention(leads: KanbanLead[]): number {
  return leads.filter((l) => {
    const state = nextActionState(l.status, l.next_action);
    return state === "overdue" || state === "missing";
  }).length;
}

export type KanbanLead = LeadListItem;

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  owner_change: "Responsable cambiado",
  status_change: "Cambio de estado",
};

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
    id: "contacted",
    label: "Esperando respuesta",
    tone: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  {
    id: "in_conversation",
    label: "En conversación",
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
  // Lead moved into an active stage with nothing scheduled: prompt for the
  // next action instead of letting it sit in the column unattended.
  const [pendingNextAction, setPendingNextAction] = useState<{
    id: string;
    name: string;
    status: LeadStatus;
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
      return;
    }

    // Any other active stage: a lead without a scheduled next step is how
    // deals quietly die, so the move itself asks for one.
    if (NEXT_ACTION_SUGGESTION[to] && !current.next_action) {
      setPendingNextAction({ id, name: leadDisplayName(current), status: to });
    }
  };

  const grouped = new Map<LeadStatus, KanbanLead[]>(COLUMNS.map((c) => [c.id, []]));
  for (const l of optimistic) grouped.get(boardColumnFor(l.status))?.push(l);
  for (const list of grouped.values()) list.sort(compareByUrgency);

  const active = activeId ? optimistic.find((l) => l.id === activeId) : null;
  const isDragging = activeId !== null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
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
            leads={grouped.get(col.id) ?? []}
            canEdit={canEdit}
            onOpenQuickView={setQuickViewId}
            onToggleCompact={() => toggleColumnCompact(col.id)}
          />
        ))}
      </div>
      <div className="flex min-h-5 items-center justify-between pt-1">
        <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          title="Actualizar leads"
        >
          <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
          <span>
            {isRefreshing
              ? "Actualizando…"
              : `Actualizado ${relativeTime(lastRefresh.toISOString())}`}
          </span>
        </button>
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
      <ScheduleReminderDialog
        key={pendingNextAction?.id ?? "next-action"}
        leadId={pendingNextAction?.id}
        open={pendingNextAction !== null}
        onOpenChange={(next) => {
          if (!next) setPendingNextAction(null);
        }}
        defaultTitle={
          pendingNextAction
            ? `${NEXT_ACTION_SUGGESTION[pendingNextAction.status] ?? "Seguimiento de"} ${pendingNextAction.name}`
            : ""
        }
        members={members}
        onScheduled={() => router.refresh()}
      />
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
  const attention = countNeedingAttention(leads);
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
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {attention > 0 && (
              <Badge
                variant="danger"
                className="h-5 gap-1 text-[11px] tabular-nums"
                title={`${attention} lead${attention === 1 ? "" : "s"} sin próxima acción o con el aviso vencido`}
              >
                <AlertTriangle className="size-2.5" aria-hidden />
                {attention}
              </Badge>
            )}
            <Badge variant="neutral" className="h-5 text-[11px] tabular-nums">
              {leads.length}
            </Badge>
          </div>
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
          leads.map((l) => (
            <Card key={l.id} lead={l} canEdit={canEdit} onOpenQuickView={onOpenQuickView} />
          ))
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

function LeadAvatar({ lead }: { lead: KanbanLead }) {
  const name = lead.client?.name ?? leadDisplayName(lead);
  return (
    <EntityAvatar
      name={name}
      logoUrl={lead.client?.logo_url}
      size="sm"
      className="size-6 rounded-full"
    />
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
  const rotting = isRotting(lead.status, lead.updated_at);
  const rotDays = STAGE_ROT_DAYS[lead.status];
  return (
    <article
      ref={setNodeRef}
      className={cn(
        "group flex flex-col gap-2 rounded-lg bg-background p-3 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-foreground/20",
        isDragging && "opacity-30",
        isOverlay && "cursor-grabbing shadow-lg ring-foreground/30",
        rotting && !isOverlay && "ring-amber-400/60 dark:ring-amber-500/40",
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
        <LeadAvatar lead={lead} />
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
        {rotting && !isOverlay && (
          <span
            role="img"
            aria-label="Lead estancado: necesita seguimiento"
            title={`Sin movimiento ${relativeTime(lead.updated_at)} (esta etapa admite ${rotDays} d)`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          >
            <AlertTriangle className="size-2.5" aria-hidden />
          </span>
        )}
      </div>
      {!isOverlay && <NextActionChip lead={lead} />}
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
          {!isOverlay && <RecentActivity lead={lead} />}
        </div>
        {lead.assignee ? <MemberFilterPopover member={lead.assignee} /> : null}
      </div>
    </article>
  );
}

/**
 * The second axis of the board: what has to happen next on this lead and when.
 * A missing next action is rendered as loudly as an overdue one — both mean
 * nobody is driving the deal. When the ball is in the lead's court the chip
 * also says since when we are waiting.
 */
function NextActionChip({ lead }: { lead: KanbanLead }) {
  const state = nextActionState(lead.status, lead.next_action);
  if (state === "none") return null;

  const waitingSince = waitingForReplySince(lead.recent_interactions);
  const waiting =
    waitingSince && state !== "overdue" ? (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
        title={`Última salida nuestra ${relativeTime(waitingSince)}`}
      >
        <Hourglass className="size-2.5 shrink-0" aria-hidden />
        <span className="truncate">Esperando respuesta {relativeTime(waitingSince)}</span>
      </span>
    ) : null;

  if (state === "missing") {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 pl-8">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
          <CalendarPlus className="size-2.5 shrink-0" aria-hidden />
          Sin próxima acción
        </span>
        {waiting}
      </div>
    );
  }

  const next = lead.next_action;
  if (!next) return null;
  const tone =
    state === "overdue"
      ? "font-medium text-red-600 dark:text-red-400"
      : state === "today"
        ? "font-medium text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <div className="flex min-w-0 flex-col gap-0.5 pl-8">
      <span
        className={cn("inline-flex min-w-0 items-center gap-1 text-[10px]", tone)}
        title={`${next.title} · ${relativeTime(next.remind_at)}`}
      >
        <CalendarClock className="size-2.5 shrink-0" aria-hidden />
        <span className="truncate">
          {state === "overdue" ? "Vencido " : ""}
          {relativeTime(next.remind_at)} · {next.title}
        </span>
      </span>
      {waiting}
    </div>
  );
}

function MemberFilterPopover({ member }: { member: LeadMemberRef }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filterByAssignee = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("assignee", member.id);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Opciones de ${member.name}`}
          title={member.name}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <MemberAvatar member={member} size="sm" className="size-5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-52 p-1"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="truncate px-2 py-1.5 text-xs font-semibold text-foreground">{member.name}</p>
        <Link
          href="/settings/team"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
        >
          <User className="size-3.5" aria-hidden />
          Ver miembro
        </Link>
        <button
          type="button"
          onClick={filterByAssignee}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
        >
          <Filter className="size-3.5" aria-hidden />
          Filtrar sus tareas
        </button>
      </PopoverContent>
    </Popover>
  );
}

function RecentActivity({ lead }: { lead: KanbanLead }) {
  const [open, setOpen] = useState(false);
  const interactions = lead.recent_interactions;
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Últimas acciones"
          title="Últimas acciones"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <HistoryIcon className="size-3" aria-hidden />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-72 p-2.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1.5 text-xs font-semibold text-foreground">Últimas acciones</p>
        {interactions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/80">Sin interacciones registradas.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {interactions.slice(0, 3).map((i) => (
              <li key={i.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-foreground">
                    {INTERACTION_LABEL[i.type] ?? i.type}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {relativeTime(i.created_at)}
                  </span>
                </div>
                {i.subject ? (
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{i.subject}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
