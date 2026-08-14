import { isActiveLeadStatus, nextActionRank, nextActionState } from "@/lib/leads/pipeline";
import type { LeadListItem } from "@/lib/leads/types";

export type LeadKanbanColumn = {
  id: LeadWorkBoardColumnId;
  label: string;
  description: string;
  tone: string;
  dot: string;
  compact?: boolean;
  focus?: boolean;
};

export type LeadWorkBoardColumnId =
  | "new"
  | "needs_action"
  | "waiting"
  | "scheduled"
  | "won"
  | "lost"
  | "not_interested"
  | "archived";

/**
 * The board is a work queue, not a copy of the sales funnel. A lead's
 * commercial stage is still preserved on the record, while its column answers
 * the operational question: who has to move next?
 */
export const LEAD_KANBAN_COLUMNS: LeadKanbanColumn[] = [
  {
    id: "new",
    label: "Nuevo",
    description: "Primer contacto pendiente",
    tone: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  {
    id: "needs_action",
    label: "Pendiente nuestro",
    description: "Algo que debemos hacer hoy",
    tone: "text-primary",
    dot: "bg-primary",
    focus: true,
  },
  {
    id: "waiting",
    label: "Esperando respuesta",
    description: "El siguiente paso es del lead",
    tone: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
    compact: true,
  },
  {
    id: "scheduled",
    label: "Llamada / reunión",
    description: "Cita futura ya acordada",
    tone: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    compact: true,
  },
  {
    id: "won",
    label: "Ganado",
    description: "Cerrado con éxito",
    tone: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    compact: true,
  },
  {
    id: "lost",
    label: "Perdido",
    description: "Cerrado",
    tone: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
    compact: true,
  },
  {
    id: "not_interested",
    label: "No interesa",
    description: "Cerrado",
    tone: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-400",
    compact: true,
  },
  {
    id: "archived",
    label: "Archivado",
    description: "Fuera del flujo",
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
    compact: true,
  },
];

export const DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS = LEAD_KANBAN_COLUMNS.filter(
  (column) => column.compact,
).map((column) => column.id);

export function groupLeadsForKanban(leads: LeadListItem[], now = new Date()) {
  const grouped = new Map<LeadWorkBoardColumnId, LeadListItem[]>(
    LEAD_KANBAN_COLUMNS.map((column) => [column.id, []]),
  );
  for (const lead of leads) grouped.get(boardColumnForLead(lead, now))?.push(lead);
  for (const column of grouped.values()) column.sort((a, b) => compareLeadsByUrgency(a, b, now));
  return grouped;
}

export function boardColumnForLead(lead: LeadListItem, now = new Date()): LeadWorkBoardColumnId {
  if (!isActiveLeadStatus(lead.status)) return lead.status as LeadWorkBoardColumnId;
  if (lead.status === "new") return "new";

  const nextAction = nextActionState(lead.status, lead.next_action, now);
  if (nextAction === "overdue" || nextAction === "today" || nextAction === "missing") {
    return "needs_action";
  }

  const type = lead.next_action?.action_type;
  if (nextAction === "scheduled" && (type === "call" || type === "meeting")) {
    return "scheduled";
  }
  return "waiting";
}

export function sumLeadEstimatedValue(leads: LeadListItem[]): number {
  return leads.reduce((total, lead) => total + (lead.estimated_value ?? 0), 0);
}

export function countLeadsNeedingAttention(leads: LeadListItem[]): number {
  return leads.filter((lead) => {
    const state = nextActionState(lead.status, lead.next_action);
    return state === "overdue" || state === "missing";
  }).length;
}

function compareLeadsByUrgency(a: LeadListItem, b: LeadListItem, now: Date): number {
  const rankA = nextActionRank(nextActionState(a.status, a.next_action, now));
  const rankB = nextActionRank(nextActionState(b.status, b.next_action, now));
  if (rankA !== rankB) return rankA - rankB;
  const dueA = a.next_action ? new Date(a.next_action.remind_at).getTime() : 0;
  const dueB = b.next_action ? new Date(b.next_action.remind_at).getTime() : 0;
  if (dueA !== dueB) return dueA - dueB;
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}
