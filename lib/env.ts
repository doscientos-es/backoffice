import { z } from "zod";

const PublicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://app.doscientos.es"),
  NEXT_PUBLIC_APP_NAME: z.string().default("doscientos backoffice"),
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: z.string().optional(),
});

const ServerSchema = PublicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Dedicated HMAC secret for portal unlock cookies. Set this to a random
  // 32-byte hex string (e.g. `openssl rand -hex 32`). Falls back to the
  // service-role key when not set; set it to reduce blast radius.
  PORTAL_COOKIE_SECRET: z.string().min(20).optional(),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(""),
  RESEND_FROM_DOMAIN: z.string().default("doscientos.es"),
  OPENAI_API_KEY: z.string().optional().default(""), // vacío = IA desactivada
  VERIFACTU_ENV: z.enum(["mock", "test", "prod"]).default("mock"),
  VERIFACTU_NIF_EMISOR: z.string().optional().default(""),
  VERIFACTU_EMISOR_NAME: z.string().default("DOSCIENTOS DESARROLLO TECNOLOGICO, S.L."),
  VERIFACTU_CERT_P12_BASE64: z.string().optional().default(""),
  VERIFACTU_CERT_PASSWORD: z.string().optional().default(""),
  VERIFACTU_CERT_EXPIRES_AT: z.string().optional().default(""),
  // Generic lead-intake webhook (Recurrev / GHL / landing forms)
  LEAD_INTAKE_TOKEN: z.string().optional().default(""),
  // Comma-separated origins allowed to POST the public landing contact form.
  // Use "*" only for local development.
  LANDING_ALLOWED_ORIGINS: z.string().default("https://doscientos.es,https://www.doscientos.es"),
  // Meta Marketing API (developers.facebook.com)
  META_APP_ID: z.string().optional().default(""),
  META_APP_SECRET: z.string().optional().default(""),
  META_VERIFY_TOKEN: z.string().optional().default(""),
  META_PAGE_ACCESS_TOKEN: z.string().optional().default(""), // Used for leads webhooks
  META_USER_ACCESS_TOKEN: z.string().optional().default(""), // Used for Marketing API (ads/insights)
  META_AD_ACCOUNT_ID: z.string().optional().default(""), // Format: act_xxxxxxxx
  META_GRAPH_API_VERSION: z.string().default("v23.0"),
  // GitHub App integration (bidirectional sync)
  GITHUB_APP_ID: z.string().optional().default(""),
  GITHUB_APP_PRIVATE_KEY_BASE64: z.string().optional().default(""), // RSA private key in base64
  GITHUB_WEBHOOK_SECRET: z.string().optional().default(""),
  // Installation ID por defecto (instalación de la App en la org doscientos-es).
  // Prerellena el campo del proyecto; cada proyecto puede sobreescribirlo.
  GITHUB_DEFAULT_INSTALLATION_ID: z.string().optional().default(""),
  CAL_WEBHOOK_SECRET: z.string().optional().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const publicEnv = PublicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
});

let cachedServerEnv: z.infer<typeof ServerSchema> | null = null;
export function serverEnv() {
  if (cachedServerEnv) return cachedServerEnv;
  cachedServerEnv = ServerSchema.parse(process.env);
  return cachedServerEnv;
}

/** true solo si OPENAI_API_KEY está configurada — usa esto para feature-gate toda la lógica de IA */
export function isAIEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
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
