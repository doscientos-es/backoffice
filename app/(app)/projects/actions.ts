"use server";

import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ProjectInput = z.object({
  client_id: z.string().uuid("Cliente inválido"),
  name: z.string().min(1, "El nombre es obligatorio").max(160),
  description: z.string().max(4000).optional().or(z.literal("").transform(() => undefined)),
  status: z.enum(["planning", "active", "on_hold", "done", "cancelled"]).default("planning"),
  github_repo: z.string().url("URL inválida").optional().or(z.literal("").transform(() => undefined)),
  starts_at: z.string().optional().or(z.literal("").transform(() => undefined)),
  ends_at: z.string().optional().or(z.literal("").transform(() => undefined)),
});

export async function createProject(formData: FormData): Promise<void> {
  await requireUser();
  const raw = {
    client_id: formData.get("client_id")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "planning",
    github_repo: formData.get("github_repo")?.toString() ?? "",
    starts_at: formData.get("starts_at")?.toString() ?? "",
    ends_at: formData.get("ends_at")?.toString() ?? "",
  };
  const parsed = ProjectInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      client_id: parsed.data.client_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      github_repo: parsed.data.github_repo ?? null,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el proyecto");
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(formData: FormData): Promise<void> {
  await requireUser();
  const id = formData.get("id")?.toString() ?? "";
  const raw = {
    client_id: formData.get("client_id")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "planning",
    github_repo: formData.get("github_repo")?.toString() ?? "",
    starts_at: formData.get("starts_at")?.toString() ?? "",
    ends_at: formData.get("ends_at")?.toString() ?? "",
  };
  const parsed = ProjectInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");
  if (!z.string().uuid().safeParse(id).success) throw new Error("ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("projects")
    .update({
      client_id: parsed.data.client_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      github_repo: parsed.data.github_repo ?? null,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}
