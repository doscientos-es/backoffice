import { boardColumnFor, nextActionRank, nextActionState } from "@/lib/leads/pipeline";
import type { LeadListItem } from "@/lib/leads/types";
import type { LeadStatus } from "@/lib/status";

export type LeadKanbanColumn = {
  id: LeadStatus;
  label: string;
  description: string;
  tone: string;
  dot: string;
};

export const LEAD_KANBAN_COLUMNS: LeadKanbanColumn[] = [
  {
    id: "new",
    label: "Nuevo",
    description: "Primer contacto pendiente",
    tone: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  {
    id: "contacted",
    label: "Contactado",
    description: "Esperando respuesta",
    tone: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  {
    id: "in_conversation",
    label: "En conversación",
    description: "Conversación activa",
    tone: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    id: "quoted",
    label: "Presupuestado",
    description: "Propuesta enviada",
    tone: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-400",
  },
  {
    id: "won",
    label: "Ganado",
    description: "Cerrado con éxito",
    tone: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    id: "lost",
    label: "Perdido",
    description: "Cerrado",
    tone: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  {
    id: "not_interested",
    label: "No interesa",
    description: "Cerrado",
    tone: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-400",
  },
  {
    id: "archived",
    label: "Archivado",
    description: "Fuera del flujo",
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
];

export function groupLeadsForKanban(leads: LeadListItem[], now = new Date()) {
  const grouped = new Map<LeadStatus, LeadListItem[]>(
    LEAD_KANBAN_COLUMNS.map((column) => [column.id, []]),
  );
  for (const lead of leads) grouped.get(boardColumnFor(lead.status))?.push(lead);
  for (const column of grouped.values()) column.sort((a, b) => compareLeadsByUrgency(a, b, now));
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

function compareLeadsByUrgency(a: LeadListItem, b: LeadListItem, now: Date): number {
  const rankA = nextActionRank(nextActionState(a.status, a.next_action, now));
  const rankB = nextActionRank(nextActionState(b.status, b.next_action, now));
  if (rankA !== rankB) return rankA - rankB;
  const dueA = a.next_action ? new Date(a.next_action.remind_at).getTime() : 0;
  const dueB = b.next_action ? new Date(b.next_action.remind_at).getTime() : 0;
  if (dueA !== dueB) return dueA - dueB;
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}
