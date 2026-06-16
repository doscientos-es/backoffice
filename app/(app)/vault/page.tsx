import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { isVaultUnlocked } from "@/lib/vault/access";
import type { Metadata } from "next";
import { VaultClient } from "./_components/vault-client";

export const metadata: Metadata = { title: "Bóveda · doscientos" };
export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const user = await requireUser();
  const supabase = await createServerClient();

  const [itemsResult, settingsResult, clientsResult] = await Promise.all([
    supabase
      .from("vault_items")
      .select("id, name, service, username, notes, is_sensitive, expires_at, client_id, created_at")
      .is("deleted_at", null)
      .order("service")
      .order("name"),
    supabase.from("settings").select("vault_password_hash").eq("id", 1).single(),
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
  ]);

  const passwordHash =
    (settingsResult.data as { vault_password_hash: string | null } | null)
      ?.vault_password_hash ?? null;

  const unlocked = await isVaultUnlocked(passwordHash);

  type VaultItemRow = {
    id: string;
    name: string;
    service: string;
    username: string | null;
    notes: string | null;
    is_sensitive: boolean;
    expires_at: string | null;
    client_id: string | null;
    created_at: string;
  };

  const isAdmin = user.role === "owner" || user.role === "admin";

  return (
    <VaultClient
      items={(itemsResult.data as VaultItemRow[] | null) ?? []}
      passwordSet={!!passwordHash}
      unlocked={unlocked}
      clients={
        (clientsResult.data as Array<{ id: string; name: string }> | null) ?? []
      }
      isAdmin={isAdmin}
    />
  );
}
