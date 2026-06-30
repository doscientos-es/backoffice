import { PublicSchema, ServerSchema } from "@/lib/env.schema";
import type { z } from "zod";

export const publicEnv = PublicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
});

let cachedServerEnv: z.infer<typeof ServerSchema> | null = null;
export function serverEnv() {
  if (cachedServerEnv) return cachedServerEnv;
  cachedServerEnv = ServerSchema.parse(process.env);
  return cachedServerEnv;
}

/** true si GEMINI_API_KEY o OPENAI_API_KEY están configuradas — feature-gate para toda la lógica de IA */
export function isAIEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

/**
 * true si la service account de Google Workspace está configurada — feature-gate
 * para Drive (backups) y Calendar (agenda de leads). Requiere email + clave.
 */
export function isGoogleEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_SA_CLIENT_EMAIL?.trim() && process.env.GOOGLE_SA_PRIVATE_KEY_BASE64?.trim(),
  );
}

/**
 * Installation ID por defecto para sync con GitHub (instalación en la org).
 * Devuelve null si no está configurado o el valor no es un entero positivo.
 */
export function githubDefaultInstallationId(): number | null {
  const raw = process.env.GITHUB_DEFAULT_INSTALLATION_ID?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
