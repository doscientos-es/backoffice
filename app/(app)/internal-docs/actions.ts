"use server";

import { defineAction } from "@/lib/actions/define-action";
import { requireRole } from "@/lib/auth";
import { InternalDocIdInput, UpdateInternalDocInput } from "@/lib/schemas/internal-doc";
import { getStorage } from "@/lib/storage";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Shape of an internal document used when diffing for the audit trail. */
type InternalDocSnapshot = {
  name: string;
  description: string | null;
  category: string;
  visibility: string;
  tags: string[] | null;
  effective_date: string | null;
  expires_at: string | null;
};

/** Scalar fields compared field-by-field to build the change log. */
const DIFFED_FIELDS = [
  "name",
  "description",
  "category",
  "visibility",
  "effective_date",
  "expires_at",
] as const;

/**
 * Compute the set of changed fields between two snapshots. Tags are compared
 * order-insensitively. Returns `{ field: { from, to } }` for changed fields.
 */
function diffInternalDoc(
  prev: InternalDocSnapshot,
  next: InternalDocSnapshot,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of DIFFED_FIELDS) {
    const before = prev[field] ?? null;
    const after = next[field] ?? null;
    if (before !== after) changes[field] = { from: before, to: after };
  }
  const prevTags = [...(prev.tags ?? [])].sort();
  const nextTags = [...(next.tags ?? [])].sort();
  if (JSON.stringify(prevTags) !== JSON.stringify(nextTags)) {
    changes.tags = { from: prev.tags ?? [], to: next.tags ?? [] };
  }
  return changes;
}

/**
 * Update an internal document's metadata (name, description, category,
 * visibility, tags, dates). Editors (owner/admin/member) may edit; only
 * admins may change visibility. Every effective change is recorded in
 * `internal_document_events` for the audit trail.
 */
export const updateInternalDoc = defineAction({
  name: "internalDocs.update",
  schema: UpdateInternalDocInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/internal-docs", `/internal-docs/${input.id}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();

    const { data: current, error: fetchError } = await supabase
      .from("internal_documents")
      .select(
        "id, name, description, category, visibility, tags, effective_date, expires_at, deleted_at",
      )
      .eq("id", input.id)
      .maybeSingle();

    if (fetchError || !current || current.deleted_at) {
      throw new Error("Documento no encontrado");
    }

    const prev = current as unknown as InternalDocSnapshot;
    const isAdmin = user.role === "owner" || user.role === "admin";

    // Changing visibility is an admin-only operation (it can expose or hide
    // documents from the rest of the team).
    if (input.visibility !== prev.visibility && !isAdmin) {
      throw new Error("Solo un administrador puede cambiar la visibilidad.");
    }

    const next: InternalDocSnapshot = {
      name: input.name,
      description: input.description?.trim() || null,
      category: input.category,
      visibility: input.visibility,
      tags: input.tags,
      effective_date: input.effective_date || null,
      expires_at: input.expires_at || null,
    };

    const { error: updateError } = await supabase
      .from("internal_documents")
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq("id", input.id);

    if (updateError) throw new Error(updateError.message);

    const changes = diffInternalDoc(prev, next);
    if (Object.keys(changes).length > 0) {
      await supabase.from("internal_document_events").insert({
        document_id: input.id,
        action: "updated",
        actor_id: user.id,
        payload: { changes },
      });
    }
  },
});

/**
 * Soft-delete an internal document and remove the file from Storage.
 * Only owner/admin can delete.
 */
export async function deleteInternalDoc(formData: FormData): Promise<void> {
  const actor = await requireRole(["owner", "admin"]);

  const parsed = InternalDocIdInput.safeParse({
    id: formData.get("id")?.toString(),
  });
  if (!parsed.success) throw new Error("ID inválido");
  const { id } = parsed.data;

  const supabase = await createServerClient();

  // Fetch storage path before deleting
  const { data: doc, error: fetchError } = await supabase
    .from("internal_documents")
    .select("id, name, storage_path, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !doc || doc.deleted_at) {
    throw new Error("Documento no encontrado");
  }

  // Soft delete
  const { error: updateError } = await supabase
    .from("internal_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);

  // Record the deletion in the audit trail before navigating away.
  await supabase.from("internal_document_events").insert({
    document_id: id,
    action: "deleted",
    actor_id: actor.id,
    payload: { name: doc.name as string },
  });

  // Best-effort: remove file from Storage
  await getStorage().remove("internal-docs", [doc.storage_path as string]);

  revalidatePath("/internal-docs");
  redirect("/internal-docs");
}
