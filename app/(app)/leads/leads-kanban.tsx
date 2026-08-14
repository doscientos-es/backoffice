"use client";

import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Filter,
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
  countLeadsNeedingAttention,
  DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS,
  groupLeadsForKanban,
  LEAD_KANBAN_COLUMNS,
  type LeadWorkBoardColumnId,
  sumLeadEstimatedValue,
} from "@/lib/leads/kanban-policy";
import {
  isRotting,
  nextActionState,
  STAGE_ROT_DAYS,
  waitingForReplySince,
} from "@/lib/leads/pipeline";
import type { LeadListItem, LeadMemberRef } from "@/lib/leads/types";
import { leadDisplayName } from "@/lib/leads/utils";
import type { MemberOption } from "@/lib/members/queries";
import { LEAD_STATUS } from "@/lib/status";
import { cn, formatEUR, relativeTime } from "@/lib/utils";
import { LeadCallLink } from "./[id]/phone-actions";
import { deleteLead } from "./actions";
import { LeadQuickView } from "./lead-quick-view";

const URGENCY_STYLE: Record<string, string> = {
  Inmediata: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  "Este mes": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Este trimestre": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  "Sin urgencia": "bg-muted text-muted-foreground",
};

export type KanbanLead = LeadListItem;

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  email_delivered: "Email entregado",
  email_opened: "Email abierto",
  email_clicked: "Email con clic",
  email_bounced: "Email rebotado",
  email_complained: "Email marcado como spam",
  email_scheduled: "Email programado",
  email_delivery_delayed: "Entrega de email retrasada",
  email_failed: "Error al enviar el email",
  email_suppressed: "Email suprimido",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  owner_change: "Responsable cambiado",
  status_change: "Cambio de estado",
};

const COMPACT_COLUMNS_KEY = "leads-kanban:workboard-compact-columns";

function loadColumnSet(key: string): Set<LeadWorkBoardColumnId> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as LeadWorkBoardColumnId[]) : null;
  } catch {
    return null;
  }
}

function saveColumnSet(key: string, value: ReadonlySet<LeadWorkBoardColumnId>) {
  try {
    localStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena…): la
    // preferencia simplemente no persiste entre sesiones.
  }
}

type Action = { type: "remove"; id: string };

export function LeadsKanban({
  leads,
  canEdit = false,
  googleEnabled = false,
  members = [],
}: {
  leads: KanbanLead[];
  canEdit?: boolean;
  googleEnabled?: boolean;
  members?: MemberOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());
  const [optimistic, applyOptimistic] = useOptimistic(leads, (state, action: Action) =>
    state.filter((l) => l.id !== action.id),
  );
  // Columnas en modo compacto: se colapsan cuando no están bajo hover.
  // Cualquier columna puede activarlo, no solo las de estado terminal; la
  // preferencia persiste en localStorage.
  const [compactColumns, setCompactColumns] = useState<ReadonlySet<LeadWorkBoardColumnId>>(
    () => new Set(DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS),
  );

  // Lee las preferencias persistidas tras el montaje: el servidor siempre
  // renderiza el set por defecto, así que aplicar esto antes provocaría un
  // mismatch de hidratación.
  useEffect(() => {
    const storedCompact = loadColumnSet(COMPACT_COLUMNS_KEY);
    if (storedCompact) setCompactColumns(storedCompact);
  }, []);

  const toggleColumnCompact = (id: LeadWorkBoardColumnId) => {
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
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const feedback = useFormFeedback();

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

  const grouped = groupLeadsForKanban(optimistic);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 h-[calc(100dvh-11rem)] min-h-[28rem] scroll-fade-x no-scrollbar">
        {LEAD_KANBAN_COLUMNS.map((col) => (
          <Column
            key={col.id}
            status={col.id}
            label={col.label}
            description={col.description}
            tone={col.tone}
            dot={col.dot}
            focus={col.focus}
            compact={compactColumns.has(col.id)}
            leads={grouped.get(col.id) ?? []}
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
      <LeadQuickView
        lead={quickViewId ? (optimistic.find((l) => l.id === quickViewId) ?? null) : null}
        canEdit={canEdit}
        googleEnabled={googleEnabled}
        members={members}
        onDeleteAction={commitDelete}
        onCloseAction={() => setQuickViewId(null)}
      />
    </>
  );
}

function Column({
  status,
  label,
  description,
  tone,
  dot,
  leads,
  onOpenQuickView,
  compact = false,
  focus = false,
  onToggleCompact,
}: {
  status: LeadWorkBoardColumnId;
  label: string;
  description: string;
  tone: string;
  dot: string;
  leads: KanbanLead[];
  onOpenQuickView: (id: string) => void;
  compact?: boolean;
  focus?: boolean;
  onToggleCompact: () => void;
}) {
  const total = sumLeadEstimatedValue(leads);
  const attention = countLeadsNeedingAttention(leads);
  // Las columnas compactas se expanden durante hover para facilitar la
  // revisión y vuelven a colapsarse al salir el cursor.
  // El comportamiento responsive se delega a Tailwind con prefijos `md:`,
  // de modo que en < md la columna siempre se renderiza expandida.
  const collapsed = compact;
  return (
    <section
      aria-label={`${label} · ${leads.length} lead${leads.length === 1 ? "" : "s"}`}
      title={collapsed ? `${label} (${leads.length}) · pasa el cursor para expandir` : undefined}
      className={cn(
        "group/col relative flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        "transition-[width,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        collapsed && "md:w-11 md:cursor-pointer md:bg-muted/30 md:hover:w-72 md:hover:bg-card",
        focus && "ring-primary/30 shadow-[0_12px_32px_-20px] shadow-primary/50",
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
          <span
            className={cn(
              "hidden text-[10px] font-normal text-muted-foreground",
              !collapsed && "md:block",
              collapsed && "md:group-hover/col:block",
            )}
          >
            {description}
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
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Sin leads</p>
        ) : (
          leads.map((l) => <Card key={l.id} lead={l} onOpenQuickView={onOpenQuickView} />)
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
  onOpenQuickView,
}: {
  lead: KanbanLead;
  onOpenQuickView?: (id: string) => void;
}) {
  const rotting = isRotting(lead.status, lead.updated_at);
  const rotDays = STAGE_ROT_DAYS[lead.status];
  return (
    <article
      className={cn(
        "group flex flex-col gap-2 rounded-lg bg-background p-3 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-foreground/20",
        rotting && "ring-amber-400/60 dark:ring-amber-500/40",
      )}
    >
      <div className="flex items-start gap-2">
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
        {rotting && (
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
      <NextActionChip lead={lead} />
      {(lead.company || lead.phone || lead.email) && (
        <div className="flex min-w-0 flex-col gap-0.5 text-xs">
          {lead.company ? <p className="truncate text-muted-foreground">{lead.company}</p> : null}
          {lead.phone ? (
            <LeadCallLink
              leadId={lead.id}
              phone={lead.phone}
              aria-label={`Llamar a ${leadDisplayName(lead)}`}
              className="inline-flex min-w-0 items-center gap-1 truncate text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Phone className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{lead.phone}</span>
            </LeadCallLink>
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
        <div className="flex flex-wrap items-center gap-1">
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
          className="truncate text-[11px] text-destructive/75"
          title={`Motivo de pérdida: ${lead.lost_reason}`}
        >
          <span className="font-medium">Pérdida:</span> {lead.lost_reason}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="neutral"
            className="h-4 max-w-24 truncate px-1.5 text-[10px]"
            title={`Estado comercial: ${LEAD_STATUS[lead.status].label}`}
          >
            {LEAD_STATUS[lead.status].label}
          </Badge>
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
          <RecentActivity lead={lead} />
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
