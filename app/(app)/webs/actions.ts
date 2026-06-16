"use server";

import { defineAction } from "@/lib/actions/define-action";
import { uuidIdInput } from "@/lib/schemas/common";
import { UpdateWebProjectInput, WebProjectInput } from "@/lib/schemas/web-project";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message ?? "No se pudo crear el proyecto web");
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
    redirect(`/webs/${input.id}`);
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
