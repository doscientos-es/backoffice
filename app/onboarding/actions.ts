"use server";

import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

type ActionResult = { ok: true } | { ok: false; error: string };

const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

const OnboardingInput = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  github_handle: z
    .string()
    .trim()
    .max(39)
    .regex(GITHUB_HANDLE_RE, "Handle de GitHub inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email_alias: z
    .string()
    .trim()
    .email("Alias no válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email_send_enabled: z.enum(["on", "off"]).transform((v) => v === "on"),
  signature_html: z
    .string()
    .max(8000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Derive the avatar URL from a GitHub handle. We use the public `.png`
 * endpoint so the avatar stays in sync without us hosting any image.
 */
function githubAvatarUrl(handle: string | null | undefined): string | null {
  if (!handle) return null;
  return `https://github.com/${handle}.png?size=200`;
}

/**
 * Mark the team_member as onboarded and persist the optional profile data
 * the user filled in during the wizard. Idempotent: calling it twice does
 * nothing harmful since `onboarded_at` is monotonic.
 */
export async function completeOnboarding(formData: FormData): Promise<ActionResult> {
  const user = await requireUser({ allowUnonboarded: true });

  const parsed = OnboardingInput.safeParse({
    name: formData.get("name")?.toString() ?? "",
    github_handle: formData.get("github_handle")?.toString() ?? "",
    email_alias: formData.get("email_alias")?.toString() ?? "",
    email_send_enabled: formData.get("email_send_enabled")?.toString() === "on" ? "on" : "off",
    signature_html: formData.get("signature_html")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }

  const supabase = await createServerClient();
  const githubHandle = parsed.data.github_handle ?? null;
  const { error } = await supabase
    .from("team_members")
    .update({
      name: parsed.data.name,
      github_handle: githubHandle,
      avatar_url: githubAvatarUrl(githubHandle),
      email_alias: parsed.data.email_alias ?? null,
      email_send_enabled: parsed.data.email_send_enabled,
      signature_html: parsed.data.signature_html ?? null,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Skip onboarding without saving extra profile data. Still marks
 * `onboarded_at` so the user is not prompted again next session.
 */
export async function skipOnboarding(): Promise<void> {
  const user = await requireUser({ allowUnonboarded: true });
  const supabase = await createServerClient();
  await supabase
    .from("team_members")
    .update({ onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/inicio");
}
