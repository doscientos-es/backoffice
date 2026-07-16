import {
  CreateTaskInput,
  MoveTaskInput,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from "@/lib/schemas/task";
import { describe, expect, it } from "vitest";

const uuid = "11111111-1111-1111-1111-111111111111";
const uuid2 = "22222222-2222-2222-2222-222222222222";

describe("TaskStatus / TaskPriority", () => {
  it("validate enum members", () => {
    expect(TaskStatus.parse("todo")).toBe("todo");
    expect(TaskPriority.parse("urgent")).toBe("urgent");
    expect(TaskStatus.safeParse("nope").success).toBe(false);
  });
});

describe("CreateTaskInput", () => {
  it("allows a personal task without project, lead or client", () => {
    expect(CreateTaskInput.safeParse({ title: "T" }).success).toBe(true);
    expect(CreateTaskInput.safeParse({ title: "T", project_id: uuid }).success).toBe(true);
    expect(CreateTaskInput.safeParse({ title: "T", lead_id: uuid }).success).toBe(true);
    expect(CreateTaskInput.safeParse({ title: "T", client_id: uuid }).success).toBe(true);
  });
  it("applies status/priority defaults", () => {
    const out = CreateTaskInput.parse({ title: "T" });
    expect(out.status).toBe("todo");
    expect(out.priority).toBe("medium");
  });
  it("rejects an empty title", () => {
    expect(CreateTaskInput.safeParse({ title: "", project_id: uuid }).success).toBe(false);
  });
});

describe("UpdateTaskInput", () => {
  it("requires id, status and priority", () => {
    expect(
      UpdateTaskInput.safeParse({
        id: uuid,
        title: "T",
        status: "done",
        priority: "high",
      }).success,
    ).toBe(true);
    expect(UpdateTaskInput.safeParse({ id: uuid, title: "T" }).success).toBe(false);
  });
});

describe("UpdateTaskStatusInput / MoveTaskInput", () => {
  it("validates status change", () => {
    expect(UpdateTaskStatusInput.safeParse({ taskId: uuid, status: "in_review" }).success).toBe(
      true,
    );
  });
  it("accepts optional before/after ids and null", () => {
    const out = MoveTaskInput.parse({
      taskId: uuid,
      status: "done",
      beforeId: uuid2,
      afterId: null,
    });
    expect(out.beforeId).toBe(uuid2);
    expect(out.afterId).toBeNull();
  });
});
