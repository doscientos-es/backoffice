"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteAsset(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!["owner", "admin"].includes(user.role)) {
    return { error: "Sin permiso" };
  }

  const supabase = await createServerClient();

  // Fetch storage_path before soft-deleting
  const { data: asset, error: fetchError } = await supabase
    .from("brand_assets")
    .select("storage_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !asset) {
    return { error: "Asset no encontrado" };
  }

  // Soft-delete in DB
  const { error: dbError } = await supabase
    .from("brand_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (dbError) return { error: dbError.message };

  // Remove from storage (best-effort)
  await createAdminClient()
    .storage.from("brand-assets")
    .remove([asset.storage_path as string]);

  revalidatePath("/assets");
  return {};
}
