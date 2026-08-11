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
  it("groups through the canonical board column and prioritizes attention", () => {
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
});
