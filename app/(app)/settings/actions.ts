"use server";

import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProfileInput = z.object({
  email_alias: z
    .string()
    .email("Alias no válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  signature_html: z.string().max(8000).optional(),
  email_send_enabled: z.enum(["on", "off"]).transform((v) => v === "on"),
});

export async function updateProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = {
    email_alias: formData.get("email_alias")?.toString() ?? "",
    signature_html: formData.get("signature_html")?.toString() ?? "",
    email_send_enabled: formData.get("email_send_enabled")?.toString() === "on" ? "on" : "off",
  };
  const parsed = ProfileInput.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      email_alias: parsed.data.email_alias ?? null,
      signature_html: parsed.data.signature_html || null,
      email_send_enabled: parsed.data.email_send_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

// ---------- Company settings ----------
const CompanyInput = z.object({
  company_name: z.string().min(1).max(160),
  company_nif: z.string().max(20).optional().or(z.literal("").transform(() => undefined)),
  company_address: z.string().max(400).optional().or(z.literal("").transform(() => undefined)),
  iban: z.string().max(40).optional().or(z.literal("").transform(() => undefined)),
  default_vat_rate: z.coerce.number().min(0).max(100),
  invoice_series: z.string().min(1).max(10),
});

export async function updateCompanySettings(formData: FormData): Promise<void> {
  await requireUser();
  const raw = {
    company_name: formData.get("company_name")?.toString() ?? "",
    company_nif: formData.get("company_nif")?.toString() ?? "",
    company_address: formData.get("company_address")?.toString() ?? "",
    iban: formData.get("iban")?.toString() ?? "",
    default_vat_rate: formData.get("default_vat_rate")?.toString() ?? "21",
    invoice_series: formData.get("invoice_series")?.toString() ?? "A",
  };
  const parsed = CompanyInput.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("settings").update({
    company_name: parsed.data.company_name,
    company_nif: parsed.data.company_nif ?? null,
    company_address: parsed.data.company_address ?? null,
    iban: parsed.data.iban ?? null,
    default_vat_rate: parsed.data.default_vat_rate,
    invoice_series: parsed.data.invoice_series,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
