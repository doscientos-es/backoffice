import { z } from "zod";
import { optionalDate, optionalText, optionalUuid, requiredText } from "./common";

/**
 * Zod schemas for the `tasks` domain.
 */

export const TaskStatus = z.enum(["todo", "in_progress", "in_review", "done", "cancelled"]);
export type TaskStatusType = z.infer<typeof TaskStatus>;

export const TaskPriority = z.enum(["low", "medium", "high", "urgent"]);
export type TaskPriorityType = z.infer<typeof TaskPriority>;

export const CreateTaskInput = z
  .object({
    title: requiredText(200, "El título es obligatorio"),
    description: optionalText(8000),
    project_id: optionalUuid,
    lead_id: optionalUuid,
    milestone_id: optionalUuid,
    assignee_id: optionalUuid,
    status: TaskStatus.default("todo"),
    priority: TaskPriority.default("medium"),
    due_date: optionalDate,
  })
  .refine((d) => d.project_id || d.lead_id, {
    message: "La tarea debe pertenecer a un proyecto o lead",
    path: ["project_id"],
  });

export type CreateTaskInputType = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  id: z.string().uuid(),
  title: requiredText(200, "El título es obligatorio"),
  description: optionalText(8000),
  milestone_id: optionalUuid,
  assignee_id: optionalUuid,
  status: TaskStatus,
  priority: TaskPriority,
  due_date: optionalDate,
});

export type UpdateTaskInputType = z.infer<typeof UpdateTaskInput>;

export const UpdateTaskStatusInput = z.object({
  taskId: z.string().uuid(),
  status: TaskStatus,
});

export type UpdateTaskStatusInputType = z.infer<typeof UpdateTaskStatusInput>;
