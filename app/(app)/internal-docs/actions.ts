"use server";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

type ActionResult = { ok: true } | { ok: false; error: string };

const IdInput = z.object({ id: z.string().uuid() });

/**
 * Soft-delete an internal document and remove the file from Storage.
 * Only owner/admin can delete.
 */
export async function deleteInternalDoc(formData: FormData): Promise<ActionResult> {
  await requireRole(["owner", "admin"]);

  const parsed = IdInput.safeParse({ id: formData.get("id")?.toString() });
  if (!parsed.success) return { ok: false, error: "ID inválido" };
  const { id } = parsed.data;

  const supabase = await createServerClient();

  // Fetch storage path before deleting
  const { data: doc, error: fetchError } = await supabase
    .from("internal_documents")
    .select("id, storage_path, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !doc || doc.deleted_at) {
    return { ok: false, error: "Documento no encontrado" };
  }

  // Soft delete
  const { error: updateError } = await supabase
    .from("internal_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) return { ok: false, error: updateError.message };

  // Best-effort: remove file from Storage (admin client bypasses bucket policies)
  const admin = createAdminClient();
  await admin.storage.from("internal-docs").remove([doc.storage_path as string]);

  revalidatePath("/internal-docs");
  redirect("/internal-docs");
}
