import {
  DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS,
  LEAD_KANBAN_COLUMNS,
  type LeadKanbanColumnId,
} from "./kanban-policy";

export type LeadKanbanColumnPreferences = {
  compact: LeadKanbanColumnId[];
  expanded: LeadKanbanColumnId[];
};

const columnIds = new Set<LeadKanbanColumnId>(LEAD_KANBAN_COLUMNS.map((column) => column.id));

export function leadKanbanColumnIds(value: unknown): LeadKanbanColumnId[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is LeadKanbanColumnId =>
      typeof id === "string" && columnIds.has(id as LeadKanbanColumnId),
  );
}

export function resolveCompactLeadKanbanColumns(
  preferences: LeadKanbanColumnPreferences,
): Set<LeadKanbanColumnId> {
  const compact = new Set(DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS);
  for (const id of preferences.compact) compact.add(id);
  for (const id of preferences.expanded) compact.delete(id);
  return compact;
}
