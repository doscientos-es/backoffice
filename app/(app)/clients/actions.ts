"use server";

import { defineAction } from "@/lib/actions/define-action";
import { requireUser } from "@/lib/auth";
import { CreateClientInput, UpdateClientInput } from "@/lib/schemas/client";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ---------- CREATE ----------
// Kept as a redirect-based form action: `<form action={createClient}>`.
// Errors throw and surface via the closest error boundary, matching the
// pre-existing behaviour. Schema is centralised in lib/schemas/client.

export async function createClient(formData: FormData): Promise<void> {
  await requireUser();
  const raw = {
    name: formData.get("name")?.toString() ?? "",
    nif: formData.get("nif")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    billing_address: formData.get("billing_address")?.toString() ?? "",
    contact_person: formData.get("contact_person")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  };
  const parsed = CreateClientInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: parsed.data.name,
      nif: parsed.data.nif ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      billing_address: parsed.data.billing_address ?? null,
      contact_person: parsed.data.contact_person ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el cliente");
  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

// ---------- UPDATE ----------
// Public, backward-compatible input shape for callers (form values are
// all-strings). The schema in lib/schemas/client validates + coerces "" to
// undefined for optional fields before the handler runs.
export type UpdateClientInputType = {
  id: string;
  name: string;
  nif: string;
  email: string;
  phone: string;
  billing_address: string;
  contact_person: string;
  notes: string;
};

export const updateClient = defineAction({
  name: "clients.update",
  schema: UpdateClientInput,
  revalidate: (_payload, input) => [`/clients/${input.id}`, "/clients"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("clients")
      .update({
        name: input.name,
        nif: input.nif ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        billing_address: input.billing_address ?? null,
        contact_person: input.contact_person ?? null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  },
});
