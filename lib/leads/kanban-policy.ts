import {
  boardColumnFor,
  isActiveLeadStatus,
  nextActionRank,
  nextActionState,
} from "@/lib/leads/pipeline";
import type { LeadListItem } from "@/lib/leads/types";
import type { LeadStatus } from "@/lib/status";

export type LeadKanbanColumn = {
  id: LeadStatus;
  label: string;
  tone: string;
  dot: string;
  compact?: boolean;
};

export const LEAD_KANBAN_COLUMNS: LeadKanbanColumn[] = [
  { id: "new", label: "Nuevo", tone: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
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

export const DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS = LEAD_KANBAN_COLUMNS.filter(
  (column) => column.compact,
).map((column) => column.id);

export function groupLeadsForKanban(leads: LeadListItem[]) {
  const grouped = new Map<LeadStatus, LeadListItem[]>(
    LEAD_KANBAN_COLUMNS.map((column) => [column.id, []]),
  );
  for (const lead of leads) grouped.get(boardColumnFor(lead.status))?.push(lead);
  for (const column of grouped.values()) column.sort(compareLeadsByUrgency);
  return grouped;
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

export type LeadAgendaBucket = "overdue" | "today" | "upcoming" | "missing";

/**
 * Operational queues are deliberately derived from the next action rather
 * than persisted as lead statuses, so pipeline reporting remains factual.
 */
export function groupLeadsForAgenda(leads: LeadListItem[], now = new Date()) {
  const grouped = new Map<LeadAgendaBucket, LeadListItem[]>([
    ["overdue", []],
    ["today", []],
    ["upcoming", []],
    ["missing", []],
  ]);

  for (const lead of leads) {
    if (!isActiveLeadStatus(lead.status)) continue;
    const state = nextActionState(lead.status, lead.next_action, now);
    const bucket =
      state === "overdue" || state === "today" || state === "missing"
        ? state
        : state === "scheduled"
          ? "upcoming"
          : null;
    if (bucket) grouped.get(bucket)?.push(lead);
  }

  for (const [bucket, bucketLeads] of grouped) {
    bucketLeads.sort((a, b) => {
      if (bucket === "missing") return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return (new Date(a.next_action?.remind_at ?? 0).getTime() - new Date(b.next_action?.remind_at ?? 0).getTime());
    });
  }
  return grouped;
}

function compareLeadsByUrgency(a: LeadListItem, b: LeadListItem): number {
  const rankA = nextActionRank(nextActionState(a.status, a.next_action));
  const rankB = nextActionRank(nextActionState(b.status, b.next_action));
  if (rankA !== rankB) return rankA - rankB;
  const dueA = a.next_action ? new Date(a.next_action.remind_at).getTime() : 0;
  const dueB = b.next_action ? new Date(b.next_action.remind_at).getTime() : 0;
  if (dueA !== dueB) return dueA - dueB;
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}
