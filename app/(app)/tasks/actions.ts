"use server";

import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { rankAfter, rankBetween } from "@/lib/utils/ranking";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const STATUS = ["todo", "in_progress", "in_review", "done", "cancelled"] as const;
const PRIORITY = ["low", "medium", "high", "urgent"] as const;

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal("").transform(() => undefined));
const optionalDate = z
  .string()
  .optional()
  .or(z.literal("").transform(() => undefined));

const CreateInput = z
  .object({
    title: z.string().min(1, "El título es obligatorio").max(200),
    description: z
      .string()
      .max(8000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    project_id: optionalUuid,
    lead_id: optionalUuid,
    milestone_id: optionalUuid,
    assignee_id: optionalUuid,
    status: z.enum(STATUS).default("todo"),
    priority: z.enum(PRIORITY).default("medium"),
    due_date: optionalDate,
    estimated_hours: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    is_billable: z.boolean().default(true),
  })
  .refine((d) => d.project_id || d.lead_id, {
    message: "La tarea debe pertenecer a un proyecto o lead",
    path: ["project_id"],
  });

function readBool(formData: FormData, name: string, fallback: boolean): boolean {
  const v = formData.get(name);
  if (v === null) return fallback;
  return v === "on" || v === "true" || v === "1";
}

export async function createTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = {
    title: formData.get("title")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    project_id: formData.get("project_id")?.toString() ?? "",
    lead_id: formData.get("lead_id")?.toString() ?? "",
    milestone_id: formData.get("milestone_id")?.toString() ?? "",
    assignee_id: formData.get("assignee_id")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "todo",
    priority: formData.get("priority")?.toString() ?? "medium",
    due_date: formData.get("due_date")?.toString() ?? "",
    estimated_hours: formData.get("estimated_hours")?.toString() ?? "",
    is_billable: readBool(formData, "is_billable", true),
  };
  const parsed = CreateInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const supabase = await createServerClient();

  // Compute kanban_order = rankAfter(max existing for same project+status).
  let kanbanOrder = "m";
  if (parsed.data.project_id) {
    const { data: last } = await supabase
      .from("tasks")
      .select("kanban_order")
      .eq("project_id", parsed.data.project_id)
      .eq("status", parsed.data.status)
      .is("deleted_at", null)
      .order("kanban_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    kanbanOrder = rankAfter((last?.kanban_order as string | null) ?? null);
  }

  const estHours =
    parsed.data.estimated_hours && parsed.data.estimated_hours.trim() !== ""
      ? Number.parseFloat(parsed.data.estimated_hours)
      : null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      project_id: parsed.data.project_id ?? null,
      lead_id: parsed.data.lead_id ?? null,
      milestone_id: parsed.data.milestone_id ?? null,
      assignee_id: parsed.data.assignee_id ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date ?? null,
      estimated_hours: Number.isFinite(estHours) ? estHours : null,
      is_billable: parsed.data.is_billable,
      kanban_order: kanbanOrder,
      created_by: user.id,
    })
    .select("id, project_id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la tarea");

  revalidatePath("/tasks");
  if (data.project_id) revalidatePath(`/projects/${data.project_id as string}`);
  redirect(`/tasks/${data.id as string}`);
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z
    .string()
    .max(8000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  milestone_id: optionalUuid,
  assignee_id: optionalUuid,
  status: z.enum(STATUS),
  priority: z.enum(PRIORITY),
  due_date: optionalDate,
  estimated_hours: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  is_billable: z.boolean().default(true),
});

export async function updateTask(formData: FormData): Promise<void> {
  await requireUser();
  const raw = {
    id: formData.get("id")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    milestone_id: formData.get("milestone_id")?.toString() ?? "",
    assignee_id: formData.get("assignee_id")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "todo",
    priority: formData.get("priority")?.toString() ?? "medium",
    due_date: formData.get("due_date")?.toString() ?? "",
    estimated_hours: formData.get("estimated_hours")?.toString() ?? "",
    is_billable: readBool(formData, "is_billable", true),
  };
  const parsed = UpdateInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const supabase = await createServerClient();
  const estHours =
    parsed.data.estimated_hours && parsed.data.estimated_hours.trim() !== ""
      ? Number.parseFloat(parsed.data.estimated_hours)
      : null;

  const updates: Record<string, unknown> = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    milestone_id: parsed.data.milestone_id ?? null,
    assignee_id: parsed.data.assignee_id ?? null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date ?? null,
    estimated_hours: Number.isFinite(estHours) ? estHours : null,
    is_billable: parsed.data.is_billable,
  };
  if (parsed.data.status === "done") updates.completed_at = new Date().toISOString();
  if (parsed.data.status === "in_progress") updates.started_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(updates).eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.id}`);
}

// ---------------- QUICK STATUS UPDATE (used by Kanban / list) ----------------

const StatusInput = z.object({
  taskId: z.string().uuid(),
  status: z.enum(STATUS),
});

export async function updateTaskStatus(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Estado no válido" };

  const supabase = await createServerClient();
  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "done") updates.completed_at = new Date().toISOString();
  if (parsed.data.status === "in_progress") updates.started_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(updates).eq("id", parsed.data.taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

// ---------------- MOVE TASK (Kanban reorder) ----------------

const MoveInput = z.object({
  taskId: z.string().uuid(),
  status: z.enum(STATUS),
  /** Task id immediately above the dropped position (null = top). */
  beforeId: z.string().uuid().nullable().optional(),
  /** Task id immediately below the dropped position (null = bottom). */
  afterId: z.string().uuid().nullable().optional(),
});

export async function moveTask(
  input: unknown,
): Promise<{ ok: true; kanbanOrder: string } | { ok: false; error: string }> {
  await requireUser();
  const parsed = MoveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimiento no válido" };

  const supabase = await createServerClient();

  const ids = [parsed.data.beforeId, parsed.data.afterId].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  let beforeOrder: string | null = null;
  let afterOrder: string | null = null;
  if (ids.length > 0) {
    const { data: neighbors } = await supabase
      .from("tasks")
      .select("id, kanban_order")
      .in("id", ids);
    for (const n of neighbors ?? []) {
      if (n.id === parsed.data.beforeId) beforeOrder = n.kanban_order as string;
      if (n.id === parsed.data.afterId) afterOrder = n.kanban_order as string;
    }
  }

  let kanbanOrder: string;
  try {
    kanbanOrder = rankBetween(beforeOrder, afterOrder);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Orden inválido" };
  }

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    kanban_order: kanbanOrder,
  };
  if (parsed.data.status === "done") updates.completed_at = new Date().toISOString();
  if (parsed.data.status === "in_progress") updates.started_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(updates).eq("id", parsed.data.taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return { ok: true, kanbanOrder };
}

// ---------------- SOFT DELETE ----------------

export async function deleteTask(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const parsed = z.object({ taskId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  return { ok: true };
}
