"use server";

import { requireUser } from "@/lib/auth";
import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const log = scopedLogger("proposals.specs");

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const CreateInput = z.object({
  proposal_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body_markdown: z.string().min(1).max(60_000),
  is_client_visible: z.boolean().default(false),
});

/**
 * Creates a proposal_spec linked to a proposal. Returns the new id so the
 * caller can navigate to it / open the editor.
 */
export async function createSpec(input: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const data = parsed.data;

  const supabase = await createServerClient();

  // Confirm the parent proposal exists and pick up project_id / client_id.
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, project_id, client_id")
    .eq("id", data.proposal_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!proposal) return { ok: false, error: "Propuesta no encontrada" };

  const { data: doc, error } = await supabase
    .from("proposal_specs")
    .insert({
      title: data.title,
      body_markdown: data.body_markdown,
      proposal_id: data.proposal_id,
      project_id: (proposal as { project_id: string | null }).project_id,
      client_id: (proposal as { client_id: string }).client_id,
      is_client_visible: data.is_client_visible,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !doc) {
    log.error({ err: error, proposalId: data.proposal_id }, "create_spec_failed");
    return { ok: false, error: error?.message ?? "No se pudo crear la documentación" };
  }

  revalidatePath(`/proposals/${data.proposal_id}`);
  return { ok: true, id: doc.id as string };
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  body_markdown: z.string().min(1).max(60_000).optional(),
});

export async function updateSpec(input: unknown): Promise<Result> {
  await requireUser();
  const parsed = UpdateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { id, ...rest } = parsed.data;

  const patch: Record<string, unknown> = {};
  if (rest.title !== undefined) patch.title = rest.title;
  if (rest.body_markdown !== undefined) patch.body_markdown = rest.body_markdown;
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createServerClient();
  const { data: doc, error } = await supabase
    .from("proposal_specs")
    .update(patch)
    .eq("id", id)
    .select("proposal_id")
    .single();

  if (error || !doc) {
    log.error({ err: error, id }, "update_spec_failed");
    return { ok: false, error: error?.message ?? "No se pudo actualizar" };
  }
  const proposalId = (doc as { proposal_id: string | null }).proposal_id;
  if (proposalId) revalidatePath(`/proposals/${proposalId}`);
  return { ok: true };
}

const ToggleInput = z.object({
  id: z.string().uuid(),
  is_client_visible: z.boolean(),
});

export async function toggleSpecVisibility(input: unknown): Promise<Result> {
  await requireUser();
  const parsed = ToggleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos no válidos" };
  }
  const supabase = await createServerClient();
  const { data: doc, error } = await supabase
    .from("proposal_specs")
    .update({ is_client_visible: parsed.data.is_client_visible })
    .eq("id", parsed.data.id)
    .select("proposal_id")
    .single();
  if (error || !doc) return { ok: false, error: error?.message ?? "No se pudo actualizar" };
  const proposalId = (doc as { proposal_id: string | null }).proposal_id;
  if (proposalId) revalidatePath(`/proposals/${proposalId}`);
  return { ok: true };
}

const DeleteInput = z.object({ id: z.string().uuid() });

export async function deleteSpec(input: unknown): Promise<Result> {
  await requireUser();
  const parsed = DeleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };
  const supabase = await createServerClient();
  const { data: doc } = await supabase
    .from("proposal_specs")
    .select("proposal_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { error } = await supabase
    .from("proposal_specs")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  const proposalId = (doc as { proposal_id: string | null } | null)?.proposal_id;
  if (proposalId) revalidatePath(`/proposals/${proposalId}`);
  return { ok: true };
}
