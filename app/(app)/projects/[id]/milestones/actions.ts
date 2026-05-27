"use server";

import { requireUser } from "@/lib/auth";
import { autoSyncMilestone } from "@/lib/integrations/github-sync";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MilestoneInput = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  amount: z.coerce.number().min(0).optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  is_payment_milestone: z.coerce.boolean().optional().default(false),
  color: z.string().optional().default("#6366f1"),
});

export async function createMilestone(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireUser();
  const parsed = MilestoneInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("milestones")
    .insert({
      project_id: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      amount: parsed.data.amount ?? null,
      start_date: parsed.data.start_date || null,
      due_date: parsed.data.due_date || null,
      is_payment_milestone: parsed.data.is_payment_milestone,
      color: parsed.data.color,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Fire-and-forget GitHub sync (only fires for bidirectional projects with auto-sync on).
  void autoSyncMilestone(data.id as string, parsed.data.projectId);

  revalidatePath(`/projects/${parsed.data.projectId}/milestones`);
  return { ok: true, id: data.id as string };
}

export async function updateMilestoneProgress(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const parsed = z
    .object({
      milestoneId: z.string().uuid(),
      projectId: z.string().uuid(),
      completion_percentage: z.coerce.number().min(0).max(100),
      status: z.string().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("milestones")
    .update({
      completion_percentage: parsed.data.completion_percentage,
      status: parsed.data.status,
      completed_at: parsed.data.completion_percentage === 100 ? now : null,
    })
    .eq("id", parsed.data.milestoneId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${parsed.data.projectId}/milestones`);
  return { ok: true };
}
