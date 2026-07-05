/**
 * Zod schemas for environment variables.
 *
 * This file is intentionally side-effect-free: it only exports schema
 * definitions so that tooling (e.g. scripts/generate-env-example.ts) can
 * import and introspect them without triggering process.env validation.
 *
 * Runtime parsing lives in lib/env.ts.
 */
import { z } from "zod";

export const PublicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://app.doscientos.es"),
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: z.string().optional(),
});

export const ServerSchema = PublicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Dedicated HMAC secret for portal unlock cookies. Set this to a random
  // 32-byte hex string (e.g. `openssl rand -hex 32`). Falls back to the
  // service-role key when not set; set it to reduce blast radius.
  PORTAL_COOKIE_SECRET: z.string().min(20).optional(),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(""),
  RESEND_FROM_DOMAIN: z.string().default("doscientos.es"),
  // AI provider selection. Set ONE of:
  //   "gemini"  → GEMINI_API_KEY (Google AI Studio, key required)
  //   "vertex"  → GOOGLE_CLOUD_PROJECT_ID + ADC (org policy, no key)
  //   "openai"  → OPENAI_API_KEY
  //   "deepseek"→ DEEPSEEK_API_KEY
  // Leave empty / unset to disable AI features.
  AI_PROVIDER: z.enum(["gemini", "vertex", "openai", "deepseek", ""]).default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  DEEPSEEK_API_KEY: z.string().optional().default(""),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional().default(""),
  GOOGLE_CLOUD_LOCATION: z.string().optional().default("us-central1"),
  VERIFACTU_ENV: z.enum(["mock", "test", "prod"]).default("mock"),
  VERIFACTU_CERT_P12_BASE64: z.string().optional().default(""),
  VERIFACTU_CERT_PASSWORD: z.string().optional().default(""),
  VERIFACTU_CERT_EXPIRES_AT: z.string().optional().default(""),
  // SistemaInformatico (required in every RegistroAlta submission).
  // For production, register the software at AEAT Sede Electrónica first:
  //   https://www.agenciatributaria.gob.es/AEAT.sede/tramitacion/Z65.shtml
  // The IdSistemaInformatico is assigned during that registration.
  VERIFACTU_SOFTWARE_NAME: z.string().default("Doscientos Backoffice"),
  VERIFACTU_SOFTWARE_ID: z.string().max(2).default("D1"),
  VERIFACTU_SOFTWARE_VERSION: z.string().default("1.0.0"),
  VERIFACTU_INSTALLATION_NUMBER: z.string().default("00000001"),
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
  GITHUB_DEFAULT_INSTALLATION_ID: z.string().optional().default(""),
  CAL_WEBHOOK_SECRET: z.string().optional().default(""),
  // Google Workspace service account (domain-wide delegation over doscientos.es).
  // Powers Drive backups and Calendar scheduling server-to-server, impersonating
  // GOOGLE_DRIVE_SUBJECT_EMAIL. Empty SA values = Google integration disabled.
  GOOGLE_WORKSPACE_DOMAIN: z.string().default("doscientos.es"),
  GOOGLE_SA_CLIENT_EMAIL: z.string().optional().default(""), // service-account@project.iam.gserviceaccount.com
  GOOGLE_SA_PRIVATE_KEY_BASE64: z.string().optional().default(""), // PEM private key, base64-encoded
  // @doscientos.es email the service account impersonates for Drive / Calendar ops.
  GOOGLE_DRIVE_SUBJECT_EMAIL: z.string().optional().default(""),
  // Drive backup root folders (top-level; client subfolders are auto-created inside).
  GOOGLE_DRIVE_INVOICES_FOLDER_ID: z.string().optional().default(""),
  GOOGLE_DRIVE_PROPOSALS_FOLDER_ID: z.string().optional().default(""),
  // Shared Google Calendar ID for lead meetings (e.g. "doscientos.es_xxx@group.calendar.google.com").
  GOOGLE_CALENDAR_ID: z.string().optional().default(""),
  // Telegram Bot — direct webhook handler (callbacks from inline buttons)
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  // Secret set in setWebhook; Telegram sends it as X-Telegram-Bot-Api-Secret-Token.
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(""),
  // Default chat/group id for outbound notifications (new leads, alerts).
  // Empty = direct Telegram send disabled (notify-new-lead falls back to n8n).
  TELEGRAM_CHAT_ID: z.string().optional().default(""),
  // File Browser (internal backup server)
  FILEBROWSER_API_URL: z.string().url().or(z.literal("")).optional().default(""),
  FILEBROWSER_USER: z.string().optional().default(""),
  FILEBROWSER_PASSWORD: z.string().optional().default(""),
  // Backup runner — lightweight HTTP endpoint on the backup server
  BACKUP_RUNNER_URL: z.string().url().or(z.literal("")).optional().default(""),
  BACKUP_RUNNER_TOKEN: z.string().optional().default(""),
  // Redsys / BBVA Paygold
  REDSYS_MERCHANT_CODE: z.string().default("370475436"),
  REDSYS_TERMINAL: z.string().default("001"),
  REDSYS_CURRENCY: z.string().default("978"), // EUR
  REDSYS_SECRET_KEY: z.string().default("sq7HjrUOBfKmC576ILgskD5srU870gJ7"), // TEST KEY
  REDSYS_ENVIRONMENT: z.enum(["test", "prod"]).default("test"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
