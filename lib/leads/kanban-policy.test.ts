import { describe, expect, it } from "vitest";
import {
  boardColumnForLead,
  countLeadsNeedingAttention,
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
  it("keeps new leads visible and prioritizes the cards that need our action", () => {
    const leads = [
      lead({ id: "scheduled", next_action: { remind_at: "2026-08-15T10:00:00.000Z" } }),
      lead({ id: "missing" }),
    ];
    expect(
      groupLeadsForKanban(leads)
        .get("new")
        ?.map((item) => item.id),
    ).toEqual(["missing", "scheduled"]);
    expect(countLeadsNeedingAttention(leads)).toBe(1);
  });

  it("sums only the known estimated value", () => {
    expect(
      sumLeadEstimatedValue([lead({ estimated_value: 200 }), lead({ estimated_value: null })]),
    ).toBe(200);
  });

  it("parks future appointments and brings them back when they are due", () => {
    const now = new Date("2026-08-14T10:00:00.000Z");
    const futureCall = lead({
      status: "in_conversation",
      next_action: { remind_at: "2026-08-18T10:00:00.000Z", action_type: "call" },
    });
    const dueCall = lead({
      status: "in_conversation",
      next_action: { remind_at: "2026-08-14T16:00:00.000Z", action_type: "call" },
    });
    const waiting = lead({
      status: "quoted",
      next_action: { remind_at: "2026-08-18T10:00:00.000Z", action_type: "follow_up" },
    });
    const missing = lead({ id: "missing", status: "quoted" });

    expect(boardColumnForLead(futureCall, now)).toBe("scheduled");
    expect(boardColumnForLead(dueCall, now)).toBe("needs_action");
    expect(boardColumnForLead(waiting, now)).toBe("waiting");
    expect(boardColumnForLead(missing, now)).toBe("needs_action");
  });
});
