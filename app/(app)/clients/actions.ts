"use server";

import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// ---------- CREATE ----------
const CreateClientInput = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160),
  nif: z.string().max(20).optional().or(z.literal("").transform(() => undefined)),
  email: z
    .string()
    .email("Email no válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z.string().max(40).optional().or(z.literal("").transform(() => undefined)),
  billing_address: z.string().max(400).optional().or(z.literal("").transform(() => undefined)),
  contact_person: z.string().max(160).optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().max(4000).optional().or(z.literal("").transform(() => undefined)),
});

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
const UpdateClientInput = CreateClientInput.extend({
  id: z.string().uuid(),
});

export async function updateClient(formData: FormData): Promise<void> {
  await requireUser();
  const raw = {
    id: formData.get("id")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    nif: formData.get("nif")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    billing_address: formData.get("billing_address")?.toString() ?? "",
    contact_person: formData.get("contact_person")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  };
  const parsed = UpdateClientInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      nif: parsed.data.nif ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      billing_address: parsed.data.billing_address ?? null,
      contact_person: parsed.data.contact_person ?? null,
      notes: parsed.data.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${parsed.data.id}`);
  revalidatePath("/clients");
}
