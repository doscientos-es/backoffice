"use server";

import { defineAction } from "@/lib/actions/define-action";
import { serverEnv } from "@/lib/env";
import { ensureClientBackupDir, isFileBrowserConfigured } from "@/lib/filebrowser";
import { uuidIdInput } from "@/lib/schemas/common";
import { UpdateWebProjectInput, WebProjectInput } from "@/lib/schemas/web-project";
import { createServerClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/vault/crypto";
import { getWebProjectDbCredentials } from "@/lib/webs/credentials";
import { redirect } from "next/navigation";
import { z } from "zod";

export const createWebProject = defineAction({
  name: "webs.create",
  schema: WebProjectInput,
  revalidate: ["/webs"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("web_projects")
      .insert({
        name: input.name,
        url: input.url,
        client_id: input.client_id ?? null,
        is_own: input.is_own ?? false,
        hosting_provider: input.hosting_provider ?? null,
        hosting_url: input.hosting_url ?? null,
        domain_registrar: input.domain_registrar ?? null,
        domain_expires_at: input.domain_expires_at ?? null,
        tech_stack: input.tech_stack ?? [],
        notes: input.notes ?? null,
        backup_slug: input.backup_slug ?? null,
        db_host: input.db_host ?? null,
        db_port: input.db_port ?? null,
        db_name: input.db_name ?? null,
        db_user: input.db_user ?? null,
        db_pass_encrypted: input.db_pass ? encryptSecret(input.db_pass) : null,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "No se pudo crear el proyecto web");

    // Auto-provision the backup folder in FileBrowser when a slug is set.
    // Fire-and-forget: failure is logged but never blocks the redirect.
    if (input.backup_slug && isFileBrowserConfigured()) {
      await ensureClientBackupDir(input.backup_slug);
    }

    redirect(`/webs/${data.id}`);
  },
});

export const updateWebProject = defineAction({
  name: "webs.update",
  schema: UpdateWebProjectInput,
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("web_projects")
      .update({
        name: input.name,
        url: input.url,
        client_id: input.client_id ?? null,
        is_own: input.is_own ?? false,
        hosting_provider: input.hosting_provider ?? null,
        hosting_url: input.hosting_url ?? null,
        domain_registrar: input.domain_registrar ?? null,
        domain_expires_at: input.domain_expires_at ?? null,
        tech_stack: input.tech_stack ?? [],
        notes: input.notes ?? null,
        backup_slug: input.backup_slug ?? null,
        db_host: input.db_host ?? null,
        db_port: input.db_port ?? null,
        db_name: input.db_name ?? null,
        db_user: input.db_user ?? null,
        // Only overwrite the encrypted password when a new one is provided;
        // an empty field keeps the existing stored value untouched.
        ...(input.db_pass ? { db_pass_encrypted: encryptSecret(input.db_pass) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) throw new Error(error.message);

    // Provision the backup folder if a slug is present (idempotent: safe to re-run).
    if (input.backup_slug && isFileBrowserConfigured()) {
      await ensureClientBackupDir(input.backup_slug);
    }

    redirect(`/webs/${input.id}`);
  },
});

/**
 * Forces an on-demand backup for a web project.
 *
 * Vercel can't run the Bash script (serverless, no Tailnet, no shell), so this
 * action decrypts the stored DB credentials and POSTs them — together with the
 * client slug — to the lightweight backup endpoint exposed on the server
 * (`BACKUP_RUNNER_URL`), authenticated with a shared Bearer token. That server
 * runs `backup-runner.sh` with the received parameters and replies with status.
 * The decrypted credentials only travel over the Tailscale network to the runner.
 */
export const triggerWebBackup = defineAction({
  name: "webs.backup",
  schema: z.object({ id: z.string().uuid(), slug: z.string().nullable().optional() }),
  handler: async (input) => {
    const env = serverEnv();
    if (!env.BACKUP_RUNNER_URL || !env.BACKUP_RUNNER_TOKEN) {
      throw new Error("El servicio de backups no está configurado.");
    }

    const credentials = await getWebProjectDbCredentials(input.id);
    if (!credentials) {
      throw new Error("Este proyecto no tiene credenciales de BD configuradas.");
    }

    let res: Response;
    try {
      res = await fetch(env.BACKUP_RUNNER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.BACKUP_RUNNER_TOKEN}`,
        },
        body: JSON.stringify({
          clientSlug: input.slug ?? null,
          host: credentials.host,
          port: credentials.port,
          database: credentials.name,
          user: credentials.user,
          password: credentials.password,
        }),
        cache: "no-store",
      });
    } catch {
      throw new Error("No se pudo contactar con el servidor de backups.");
    }

    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(detail?.error ?? `El backup ha fallado (HTTP ${res.status}).`);
    }
  },
});

export const deleteWebProject = defineAction({
  name: "webs.delete",
  schema: uuidIdInput,
  revalidate: ["/webs"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("web_projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
    redirect("/webs");
  },
});
