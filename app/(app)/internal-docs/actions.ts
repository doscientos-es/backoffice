"use server";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const IdInput = z.object({ id: z.string().uuid() });

/**
 * Soft-delete an internal document and remove the file from Storage.
 * Only owner/admin can delete.
 */
export async function deleteInternalDoc(formData: FormData): Promise<void> {
  await requireRole(["owner", "admin"]);

  const parsed = IdInput.safeParse({ id: formData.get("id")?.toString() });
  if (!parsed.success) throw new Error("ID inválido");
  const { id } = parsed.data;

  const supabase = await createServerClient();

  // Fetch storage path before deleting
  const { data: doc, error: fetchError } = await supabase
    .from("internal_documents")
    .select("id, storage_path, deleted_at")
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

  // Best-effort: remove file from Storage (admin client bypasses bucket policies)
  const admin = createAdminClient();
  await admin.storage.from("internal-docs").remove([doc.storage_path as string]);

  revalidatePath("/internal-docs");
  redirect("/internal-docs");
}
