"use server";

import { defineAction } from "@/lib/actions/define-action";
import { parseGithubRepoUrl } from "@/lib/integrations/github-sync";
import { ProjectInput, UpdateProjectInput } from "@/lib/schemas/project";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function buildDbPayload(p: any) {
  const repo = p.github_repo ? parseGithubRepoUrl(p.github_repo) : null;
  return {
    client_id: p.client_id,
    name: p.name,
    description: p.description ?? null,
    status: p.status,
    starts_at: p.starts_at ?? null,
    ends_at: p.ends_at ?? null,
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

    revalidatePath("/projects");
    redirect(`/projects/${data.id}`);
  },
});

export const updateProject = defineAction({
  name: "projects.update",
  schema: UpdateProjectInput,
  revalidate: (payload, input) => ["/projects", `/projects/${input.id}`],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("projects")
      .update({ ...buildDbPayload(input), updated_at: new Date().toISOString() })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
  },
});
