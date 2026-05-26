"use server";

import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Start timer ───────────────────────────────────────────────────────────────

const StartInput = z.object({
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  description: z.string().max(500).optional(),
});

export async function startTimer(
  input: unknown,
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = StartInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };

  const supabase = await createServerClient();

  // Stop any running timer first (unique index prevents two active timers).
  const { data: active } = await supabase
    .from("time_entries")
    .select("id")
    .eq("member_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  if (active) {
    await supabase
      .from("time_entries")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      member_id: user.id,
      project_id: parsed.data.projectId,
      task_id: parsed.data.taskId ?? null,
      started_at: new Date().toISOString(),
      description: parsed.data.description ?? null,
      is_billable: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks/timer");
  if (parsed.data.taskId) revalidatePath(`/tasks/${parsed.data.taskId}`);
  return { ok: true, entryId: data.id as string };
}

// ── Stop timer ────────────────────────────────────────────────────────────────

export async function stopTimer(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createServerClient();

  const { data: active } = await supabase
    .from("time_entries")
    .select("id, task_id")
    .eq("member_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  if (!active) return { ok: false, error: "No hay timer activo" };

  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", active.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks/timer");
  if (active.task_id) revalidatePath(`/tasks/${active.task_id as string}`);
  return { ok: true };
}

// ── Log time (manual) ─────────────────────────────────────────────────────────

const LogInput = z.object({
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  description: z.string().max(500).optional(),
  isBillable: z.boolean().default(true),
});

export async function logTime(formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = {
    taskId: formData.get("task_id")?.toString() || undefined,
    projectId: formData.get("project_id")?.toString() ?? "",
    startedAt: formData.get("started_at")?.toString() ?? "",
    endedAt: formData.get("ended_at")?.toString() ?? "",
    description: formData.get("description")?.toString() || undefined,
    isBillable: formData.get("is_billable") !== "false",
  };
  const parsed = LogInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message);

  const supabase = await createServerClient();
  const { error } = await supabase.from("time_entries").insert({
    member_id: user.id,
    project_id: parsed.data.projectId,
    task_id: parsed.data.taskId ?? null,
    started_at: parsed.data.startedAt,
    ended_at: parsed.data.endedAt,
    description: parsed.data.description ?? null,
    is_billable: parsed.data.isBillable,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/tasks/timer");
  if (parsed.data.taskId) revalidatePath(`/tasks/${parsed.data.taskId}`);
}

// ── Delete entry ──────────────────────────────────────────────────────────────

export async function deleteTimeEntry(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = z.object({ entryId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", parsed.data.entryId)
    .eq("member_id", user.id); // own entries only

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks/timer");
  return { ok: true };
}
