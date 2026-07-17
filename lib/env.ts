import { PublicSchema, ServerSchema } from "@/lib/env.schema";
import type { z } from "zod";

export const publicEnv = PublicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
  NEXT_PUBLIC_CAL_LINK: process.env.NEXT_PUBLIC_CAL_LINK,
});

/** Strip leading/trailing whitespace (incl. \r from CRLF .env files) from all values. */
function trimEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
  );
}

let cachedServerEnv: z.infer<typeof ServerSchema> | null = null;
export function serverEnv() {
  if (cachedServerEnv) return cachedServerEnv;
  cachedServerEnv = ServerSchema.parse(trimEnv(process.env));
  return cachedServerEnv;
}

/**
 * true si la IA está lista para usarse — feature-gate para toda la lógica de IA.
 * Hoy solo está cableado Vertex (ver resolveModel() en lib/ai.ts):
 *   "vertex" → necesita GOOGLE_CLOUD_PROJECT_ID (usa ADC, sin API key)
 * Para reactivar otros proveedores en el futuro, añade aquí su check y su
 * branch en resolveModel().
 */
export function isAIEnabled(): boolean {
  const provider = process.env.AI_PROVIDER?.trim();
  if (provider === "vertex") return Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID?.trim());
  return false;
}

/**
 * true si la service account de Google Workspace está configurada — feature-gate
 * para Drive (backups) y Calendar (agenda de leads). Requiere email + clave.
 */
export function isGoogleEnabled(): boolean {
  const demoMode =
    process.env.DEMO_MODE?.trim() === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE?.trim() === "true";
  return Boolean(
    !demoMode &&
      process.env.GOOGLE_SA_CLIENT_EMAIL?.trim() &&
      process.env.GOOGLE_SA_PRIVATE_KEY_BASE64?.trim(),
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
