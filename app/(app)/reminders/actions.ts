"use server";

import { requireUser } from "@/lib/auth";
import { CreateReminderInput, ReminderIdInput } from "@/lib/schemas/reminder";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateReminderResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Creates a reminder linked to a lead, client or project. Used from the
 * lead detail page (quick action "Agendar") so the user can schedule a
 * follow-up call right after contacting a lead.
 */
export async function createReminder(input: unknown): Promise<CreateReminderResult> {
  const user = await requireUser();
  const parsed = CreateReminderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { title, remindAt, notes, leadId, clientId, projectId } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      title,
      remind_at: new Date(remindAt).toISOString(),
      notes: notes?.trim() || null,
      lead_id: leadId ?? null,
      client_id: clientId ?? null,
      project_id: projectId ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el aviso" };

  revalidatePath("/inicio");
  revalidatePath("/reminders");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: data.id as string };
}

/**
 * Marks a reminder as completed (sets `completed_at = now()`).
 * Invoked from quick-action buttons (e.g. AvisosPanel on /inicio).
 */
export async function completeReminder(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = ReminderIdInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("reminders")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .is("completed_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/inicio");
  revalidatePath("/reminders");
  return { ok: true };
}

/**
 * Reopens a previously completed reminder (sets `completed_at = null`).
 */
export async function uncompleteReminder(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = ReminderIdInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("reminders")
    .update({ completed_at: null })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/inicio");
  revalidatePath("/reminders");
  return { ok: true };
}
