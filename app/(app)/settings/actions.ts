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
  email_send_enabled: z.enum(["on", "off"]).transform((v) => v === "on"),
  github_handle: z
    .string()
    .max(39)
    .regex(/^[a-zA-Z0-9-]*$/, "Handle de GitHub inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  job_title: z
    .string()
    .max(160)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  contact_email: z
    .string()
    .email("Email de contacto no válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

function buildSignatureHtml(opts: {
  name: string;
  jobTitle?: string;
  contactEmail?: string;
  phone?: string;
}): string {
  const lines: string[] = [];
  lines.push(`<strong>${opts.name}</strong>`);
  if (opts.jobTitle) lines.push(opts.jobTitle);
  lines.push("");
  lines.push("<strong>doscientos.es</strong>");
  lines.push(
    '<span style="color:#666">Construimos productos digitales escalables para empresas que quieren crecer con tecnología.</span>',
  );
  lines.push("");
  if (opts.contactEmail)
    lines.push(
      `📩 <a href="mailto:${opts.contactEmail}" style="color:inherit">${opts.contactEmail}</a>`,
    );
  lines.push('🌐 <a href="https://doscientos.es" style="color:inherit">https://doscientos.es</a>');
  if (opts.phone) lines.push(`📱 ${opts.phone}`);
  return `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:0">${lines.join("<br/>")}</p>`;
}

export async function updateProfile(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const raw = {
    email_alias: formData.get("email_alias")?.toString() ?? "",
    email_send_enabled: formData.get("email_send_enabled")?.toString() === "on" ? "on" : "off",
    github_handle: formData.get("github_handle")?.toString() ?? "",
    job_title: formData.get("job_title")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    contact_email: formData.get("contact_email")?.toString() ?? "",
  };
  const parsed = ProfileInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }

  const signatureHtml = buildSignatureHtml({
    name: user.name,
    jobTitle: parsed.data.job_title,
    contactEmail: parsed.data.contact_email ?? parsed.data.email_alias,
    phone: parsed.data.phone,
  });

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      email_alias: parsed.data.email_alias ?? null,
      signature_html: signatureHtml,
      email_send_enabled: parsed.data.email_send_enabled,
      github_handle: parsed.data.github_handle ?? null,
      job_title: parsed.data.job_title ?? null,
      phone: parsed.data.phone ?? null,
      contact_email: parsed.data.contact_email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/profile");
  return { ok: true };
}

// ---------- Company settings ----------
const CompanyInput = z.object({
  company_name: z.string().min(1).max(160),
  company_nif: z
    .string()
    .max(20)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  company_address: z
    .string()
    .max(400)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  iban: z
    .string()
    .max(40)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  default_vat_rate: z.coerce.number().min(0).max(100),
  invoice_series: z.string().min(1).max(10),
});

export async function updateCompanySettings(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("settings")
    .update({
      company_name: parsed.data.company_name,
      company_nif: parsed.data.company_nif ?? null,
      company_address: parsed.data.company_address ?? null,
      iban: parsed.data.iban ?? null,
      default_vat_rate: parsed.data.default_vat_rate,
      invoice_series: parsed.data.invoice_series,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/company");
  return { ok: true };
}
