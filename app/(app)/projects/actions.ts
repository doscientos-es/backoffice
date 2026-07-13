"use server";

import { defineAction } from "@/lib/actions/define-action";
import { parseGithubRepoUrl } from "@/lib/integrations/github-sync";
import { uuidIdInput } from "@/lib/schemas/common";
import { ProjectInput, UpdateProjectInput } from "@/lib/schemas/project";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// biome-ignore lint/suspicious/noExplicitAny: complex dynamic payload from form
function buildDbPayload(p: any) {
  const repo = p.github_repo ? parseGithubRepoUrl(p.github_repo) : null;
  const isHourly = p.billing_type === "hourly";
  return {
    client_id: p.client_id,
    name: p.name,
    description: p.description ?? null,
    status: p.status,
    starts_at: p.starts_at ?? null,
    ends_at: p.ends_at ?? null,
    billing_type: p.billing_type,
    hourly_rate: isHourly ? (p.hourly_rate ?? null) : null,
    hourly_vat_rate: isHourly ? p.hourly_vat_rate : 21,
    github_sync_mode: p.github_sync_mode,
    github_auto_sync: p.github_sync_mode === "bidirectional" ? p.github_auto_sync : true,
    github_repo: p.github_sync_mode === "none" ? null : (p.github_repo ?? null),
    github_repo_owner: p.github_sync_mode === "none" ? null : (repo?.owner ?? null),
    github_repo_name: p.github_sync_mode === "none" ? null : (repo?.name ?? null),
    github_installation_id:
      p.github_sync_mode === "bidirectional" ? (p.github_installation_id ?? null) : null,
  };
}

export const createProject = defineAction({
  name: "projects.create",
  schema: ProjectInput,
  handler: async (input) => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("projects")
      .insert(buildDbPayload(input))
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "No se pudo crear el proyecto");

    // Apply onboarding template if requested
    if (input.template_id) {
      const { data: tplItems } = await supabase
        .from("onboarding_template_items")
        .select("label, position")
        .eq("template_id", input.template_id)
        .order("position");

      if (tplItems && tplItems.length > 0) {
        await supabase.from("project_checklist_items").insert(
          tplItems.map((item) => ({
            project_id: data.id,
            label: item.label as string,
            position: item.position as number,
          })),
        );
      }
    }

    revalidatePath("/projects");
    redirect(`/projects/${data.id}`);
  },
});

export const updateProject = defineAction({
  name: "projects.update",
  schema: UpdateProjectInput,
  revalidate: (_payload, input) => ["/projects", `/projects/${input.id}`],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("projects")
      .update({ ...buildDbPayload(input), updated_at: new Date().toISOString() })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
  },
});

/**
 * Soft-deletes a project by stamping `deleted_at`. The list and detail
 * queries filter on `deleted_at is null`, so the row simply disappears
 * from the UI. Related proposals/invoices keep their `project_id` until
 * a hard delete occurs (FKs are `on delete set null`).
 */
export const deleteProject = defineAction({
  name: "projects.delete",
  schema: uuidIdInput,
  revalidate: () => ["/projects"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
  },
});

/**
 * Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
 * shown after `deleteProject`, returning the project to the UI.
 */
export const restoreProject = defineAction({
  name: "projects.restore",
  schema: uuidIdInput,
  revalidate: (_payload, input) => [`/projects/${input.id}`, "/projects"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("projects")
      .update({ deleted_at: null })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
  },
});
