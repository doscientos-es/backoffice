"use server";

import { defineAction } from "@/lib/actions/define-action";
import { uuidIdInput } from "@/lib/schemas/common";
import {
  CreateVaultItemInput,
  UpdateVaultItemInput,
  VaultPasswordInput,
  VaultUnlockInput,
} from "@/lib/schemas/vault";
import { createServerClient } from "@/lib/supabase/server";
import {
  grantVaultUnlock,
  hashVaultPassword,
  isVaultUnlocked,
  revokeVaultUnlock,
  verifyVaultPassword,
} from "@/lib/vault/access";
import { decryptSecret, encryptSecret } from "@/lib/vault/crypto";
import { z } from "zod";

// ── helpers ──────────────────────────────────────────────────────────────────

async function getVaultPasswordHash(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("settings")
    .select("vault_password_hash")
    .eq("id", 1)
    .single();
  return (data as { vault_password_hash: string | null } | null)?.vault_password_hash ?? null;
}

// ── actions ───────────────────────────────────────────────────────────────────

export const createVaultItem = defineAction({
  name: "vault.create",
  schema: CreateVaultItemInput,
  revalidate: () => ["/vault"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase.from("vault_items").insert({
      name: input.name,
      service: input.service,
      username: input.username ?? null,
      secret_encrypted: encryptSecret(input.secret),
      notes: input.notes ?? null,
      is_sensitive: input.is_sensitive ?? true,
      expires_at: input.expires_at ?? null,
      client_id: input.client_id ?? null,
    });
    if (error) throw new Error(error.message);
  },
});

export const updateVaultItem = defineAction({
  name: "vault.update",
  schema: UpdateVaultItemInput,
  revalidate: () => ["/vault"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const patch: Record<string, unknown> = {
      name: input.name,
      service: input.service,
      username: input.username ?? null,
      notes: input.notes ?? null,
      is_sensitive: input.is_sensitive ?? true,
      expires_at: input.expires_at ?? null,
      client_id: input.client_id ?? null,
      updated_at: new Date().toISOString(),
    };
    if (input.secret) patch.secret_encrypted = encryptSecret(input.secret);
    const { error } = await supabase.from("vault_items").update(patch).eq("id", input.id);
    if (error) throw new Error(error.message);
  },
});

export const deleteVaultItem = defineAction({
  name: "vault.delete",
  schema: uuidIdInput,
  revalidate: () => ["/vault"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("vault_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  },
});

export const unlockVault = defineAction({
  name: "vault.unlock",
  schema: VaultUnlockInput,
  handler: async (input) => {
    const hash = await getVaultPasswordHash();
    if (!hash) return; // no password set
    if (!verifyVaultPassword(input.password, hash)) throw new Error("Contraseña incorrecta");
    await grantVaultUnlock(hash);
  },
});

export const lockVault = defineAction({
  name: "vault.lock",
  handler: async () => {
    await revokeVaultUnlock();
  },
});

export const setVaultPassword = defineAction({
  name: "vault.setPassword",
  schema: VaultPasswordInput,
  revalidate: () => ["/vault"],
  handler: async (input) => {
    const existingHash = await getVaultPasswordHash();
    if (existingHash) {
      if (!input.current_password) throw new Error("Introduce la contraseña actual");
      if (!verifyVaultPassword(input.current_password, existingHash))
        throw new Error("Contraseña actual incorrecta");
    }
    const newHash = hashVaultPassword(input.password);
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("settings")
      .update({ vault_password_hash: newHash })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    await grantVaultUnlock(newHash);
  },
});

export const revealVaultSecret = defineAction({
  name: "vault.reveal",
  schema: z.object({ id: z.string().uuid(), is_sensitive: z.boolean() }),
  handler: async (input) => {
    const hash = await getVaultPasswordHash();
    if (input.is_sensitive && !(await isVaultUnlocked(hash))) {
      throw new Error("Desbloquea la bóveda para ver este secreto");
    }
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("vault_items")
      .select("secret_encrypted")
      .eq("id", input.id)
      .is("deleted_at", null)
      .single();
    if (error || !data) throw new Error("Item no encontrado");
    return { secret: decryptSecret((data as { secret_encrypted: string }).secret_encrypted) };
  },
});
