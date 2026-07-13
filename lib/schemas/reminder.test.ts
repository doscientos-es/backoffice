import { CreateReminderInput, ReminderIdInput } from "@/lib/schemas/reminder";
import { describe, expect, it } from "vitest";

const uuid = "11111111-1111-1111-1111-111111111111";

const base = { title: "Llamar", remindAt: "2025-02-01T10:00:00Z", leadId: uuid };

describe("CreateReminderInput", () => {
  it("accepts a reminder linked to a lead", () => {
    expect(CreateReminderInput.safeParse(base).success).toBe(true);
  });
  it("accepts links to client or project", () => {
    expect(
      CreateReminderInput.safeParse({ title: "X", remindAt: base.remindAt, clientId: uuid })
        .success,
    ).toBe(true);
    expect(
      CreateReminderInput.safeParse({ title: "X", remindAt: base.remindAt, projectId: uuid })
        .success,
    ).toBe(true);
  });
  it("requires at least one relation", () => {
    expect(CreateReminderInput.safeParse({ title: "X", remindAt: base.remindAt }).success).toBe(
      false,
    );
  });
  it("requires a non-empty title", () => {
    expect(CreateReminderInput.safeParse({ ...base, title: "" }).success).toBe(false);
  });
  it("rejects an unparseable date", () => {
    expect(CreateReminderInput.safeParse({ ...base, remindAt: "not-a-date" }).success).toBe(false);
    expect(CreateReminderInput.safeParse({ ...base, remindAt: "" }).success).toBe(false);
  });
});

describe("ReminderIdInput", () => {
  it("validates the uuid payload", () => {
    expect(ReminderIdInput.safeParse({ id: uuid }).success).toBe(true);
    expect(ReminderIdInput.safeParse({ id: "x" }).success).toBe(false);
  });
});
