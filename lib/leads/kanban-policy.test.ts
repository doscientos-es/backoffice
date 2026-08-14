import { describe, expect, it } from "vitest";
import {
  countLeadsNeedingAttention,
  groupLeadsForAgenda,
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

  it("groups active leads by their operational next action, not their pipeline status", () => {
    const now = new Date("2026-08-14T10:00:00.000Z");
    const leads = [
      lead({ id: "overdue", next_action: { remind_at: "2026-08-14T09:00:00.000Z" } }),
      lead({ id: "today", next_action: { remind_at: "2026-08-14T16:00:00.000Z" } }),
      lead({ id: "upcoming", next_action: { remind_at: "2026-08-18T10:00:00.000Z" } }),
      lead({ id: "missing" }),
      lead({ id: "closed", status: "won", next_action: { remind_at: "2026-08-18T10:00:00.000Z" } }),
    ];
    const agenda = groupLeadsForAgenda(leads, now);
    expect(agenda.get("overdue")?.map((item) => item.id)).toEqual(["overdue"]);
    expect(agenda.get("today")?.map((item) => item.id)).toEqual(["today"]);
    expect(agenda.get("upcoming")?.map((item) => item.id)).toEqual(["upcoming"]);
    expect(agenda.get("missing")?.map((item) => item.id)).toEqual(["missing"]);
  });
});
