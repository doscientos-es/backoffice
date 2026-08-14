import { describe, expect, it } from "vitest";
import {
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

    expect(grouped.get("contacted")?.map((item) => item.id)).toEqual(["contacted"]);
    expect(grouped.get("quoted")?.map((item) => item.id)).toEqual(["quoted"]);
  });
});
