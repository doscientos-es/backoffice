"use server";

import { requireUser } from "@/lib/auth";
import { parseGithubRepoUrl } from "@/lib/integrations/github-sync";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const SYNC_MODES = ["none", "link_only", "bidirectional"] as const;

const ProjectInput = z
  .object({
    client_id: z.string().uuid("Cliente inválido"),
    name: z.string().min(1, "El nombre es obligatorio").max(160),
    description: z
      .string()
      .max(4000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    status: z.enum(["planning", "active", "on_hold", "done", "cancelled"]).default("planning"),

    // --- GitHub integration ---
    github_sync_mode: z.enum(SYNC_MODES).default("none"),
    github_auto_sync: z.coerce.boolean().default(true),
    github_repo: z
      .string()
      .url("URL inválida")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    github_installation_id: z
      .union([z.coerce.number().int().positive(), z.literal("").transform(() => undefined)])
      .optional(),

    starts_at: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    ends_at: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .superRefine((d, ctx) => {
    if (d.github_sync_mode === "none") return;

    if (!d.github_repo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["github_repo"],
        message: "Indica la URL del repositorio.",
      });
      return;
    }
    const parsed = parseGithubRepoUrl(d.github_repo);
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["github_repo"],
        message: "URL no válida. Formato: https://github.com/owner/repo",
      });
      return;
    }
    if (d.github_sync_mode === "bidirectional" && !d.github_installation_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["github_installation_id"],
        message: "Se necesita el Installation ID de la GitHub App para sync bidireccional.",
      });
    }
  });

type ParsedInput = z.infer<typeof ProjectInput>;

function buildDbPayload(p: ParsedInput) {
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

function readForm(formData: FormData) {
  return {
    client_id: formData.get("client_id")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "planning",
    github_sync_mode: formData.get("github_sync_mode")?.toString() ?? "none",
    github_auto_sync: formData.get("github_auto_sync") ? true : false,
    github_repo: formData.get("github_repo")?.toString() ?? "",
    github_installation_id: formData.get("github_installation_id")?.toString() ?? "",
    starts_at: formData.get("starts_at")?.toString() ?? "",
    ends_at: formData.get("ends_at")?.toString() ?? "",
  };
}

export async function createProject(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = ProjectInput.safeParse(readForm(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(buildDbPayload(parsed.data))
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el proyecto");
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(formData: FormData): Promise<void> {
  await requireUser();
  const id = formData.get("id")?.toString() ?? "";
  if (!z.string().uuid().safeParse(id).success) throw new Error("ID inválido");
  const parsed = ProjectInput.safeParse(readForm(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("projects")
    .update({ ...buildDbPayload(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}
