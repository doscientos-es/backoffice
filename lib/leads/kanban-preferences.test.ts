import { describe, expect, it } from "vitest";
import { leadKanbanColumnIds, resolveCompactLeadKanbanColumns } from "./kanban-preferences";

describe("lead kanban column preferences", () => {
  it("keeps configured closed columns compact despite legacy compact preferences", () => {
    const compact = resolveCompactLeadKanbanColumns({ compact: ["new"], expanded: [] });

    expect([...compact]).toEqual(["won", "lost", "not_interested", "archived", "new"]);
  });

  it("allows explicitly expanded columns and ignores invalid stored ids", () => {
    const compact = resolveCompactLeadKanbanColumns({
      compact: leadKanbanColumnIds(["new", "unknown"]),
      expanded: leadKanbanColumnIds(["won", "invalid"]),
    });

    expect([...compact]).toEqual(["lost", "not_interested", "archived", "new"]);
  });
});
