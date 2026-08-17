import { describe, expect, it } from "vitest";
import {
  boardColumnForLead,
  countLeadsNeedingAttention,
  DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS,
  groupLeadsForKanban,
  sumLeadEstimatedValue,
} from "./kanban-policy";

const lead = (overrides: Record<string, unknown> = {}) =>
  ({
    id: crypto.randomUUID(),
    status: "new",
    updated_at: "2026-08-11T10:00:00.000Z",
    estimated_value: 0,
    next_action: null,
    ...overrides,
  }) as never;

describe("lead kanban policy", () => {
  it("collapses terminal columns by default", () => {
    expect(DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS).toEqual([
      "won",
      "lost",
      "not_interested",
      "archived",
    ]);
  });

  it("keeps new leads visible and prioritizes the cards that need our action", () => {
    const leads = [
      lead({ id: "scheduled", next_action: { remind_at: "2026-08-15T10:00:00.000Z" } }),
      lead({ id: "missing" }),
    ];
    expect(
      groupLeadsForKanban(leads, new Date("2026-08-14T10:00:00.000Z"))
        .get("new")
        ?.map((item) => item.id),
    ).toEqual(["missing", "scheduled"]);
    expect(countLeadsNeedingAttention(leads, new Date("2026-08-14T10:00:00.000Z"))).toBe(1);
  });

  it("sums only the known estimated value", () => {
    expect(
      sumLeadEstimatedValue([lead({ estimated_value: 200 }), lead({ estimated_value: null })]),
    ).toBe(200);
  });

  it("keeps leads in their commercial column regardless of the next action", () => {
    const leads = [
      lead({
        id: "contacted",
        status: "contacted",
        next_action: { remind_at: "2026-08-18T10:00:00.000Z" },
      }),
      lead({ id: "quoted", status: "quoted", next_action: null }),
    ];
    const grouped = groupLeadsForKanban(leads);

    expect(grouped.get("waiting")?.map((item) => item.id)).toEqual(["contacted"]);
    expect(grouped.get("quoted")?.map((item) => item.id)).toEqual(["quoted"]);
  });

  it("puts future calls and meetings in their operational column", () => {
    const call = lead({
      id: "call",
      status: "new",
      next_action: {
        remind_at: "2026-08-18T10:00:00.000Z",
        action_type: "call",
      },
    });
    const meeting = lead({
      id: "meeting",
      status: "in_conversation",
      next_action: {
        remind_at: "2026-08-18T10:00:00.000Z",
        action_type: "meeting",
      },
    });
    const now = new Date("2026-08-14T10:00:00.000Z");

    expect(boardColumnForLead(call, now)).toBe("meeting");
    expect(boardColumnForLead(meeting, now)).toBe("meeting");
  });
});
