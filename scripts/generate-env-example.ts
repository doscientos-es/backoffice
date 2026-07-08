/**
 * Generates .env.example from the Zod schemas in lib/env.schema.ts.
 *
 * Usage:  pnpm env:example
 *
 * Fields marked REQUIRED have no default and must be set.
 * Fields with a default show their default value; override only when needed.
 * Optional fields without a default are shown with an empty value.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

// Resolve root so the script works from any cwd.
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

// Dynamic import avoids compile-time path-alias issues.
// Use pathToFileURL so Windows absolute paths are valid ESM URLs.
const { ServerSchema } = (await import(pathToFileURL(resolve(root, "lib/env.schema.ts")).href)) as {
  ServerSchema: z.ZodObject<z.ZodRawShape>;
};

// ── Zod introspection ─────────────────────────────────────────────────────────

type FieldMeta = {
  required: boolean;
  defaultVal?: string; // defined → show as value; undefined → empty
  hint: string; // e.g. "url", "enum: mock|test|prod"
};

function describeField(schema: z.ZodTypeAny): FieldMeta {
  if (schema instanceof z.ZodDefault) {
    const inner = describeField(schema._def.innerType as z.ZodTypeAny);
    const raw: unknown = schema._def.defaultValue();
    const defaultVal = raw === "" ? undefined : String(raw);
    return { ...inner, required: false, defaultVal };
  }
  if (schema instanceof z.ZodOptional) {
    return { ...describeField(schema._def.innerType as z.ZodTypeAny), required: false };
  }
  if (schema instanceof z.ZodString) {
    const checks = (schema._def.checks ?? []) as Array<{ kind: string; value?: number }>;
    const parts: string[] = [];
    for (const c of checks) {
      if (c.kind === "url") parts.push("url");
      if (c.kind === "email") parts.push("email");
      if (c.kind === "min" && c.value) parts.push(`min(${c.value})`);
    }
    return { required: true, hint: parts.join(", ") };
  }
  if (schema instanceof z.ZodEnum) {
    return { required: true, hint: `enum: ${(schema._def.values as string[]).join(" | ")}` };
  }
  if (schema instanceof z.ZodUnion) {
    return { required: true, hint: "url (or empty)" };
  }
  return { required: true, hint: "" };
}

function formatLine(key: string, meta: FieldMeta): string {
  const value = meta.defaultVal ?? "";
  const base = `${key}=${value}`;

  const tags: string[] = [];
  if (meta.required) tags.push("REQUIRED");
  else if (!meta.defaultVal) tags.push("optional");
  if (meta.hint) tags.push(meta.hint);

  const comment = tags.length ? `  # ${tags.join("  ")}` : "";
  return `${base}${comment}`;
}

// ── Groups ────────────────────────────────────────────────────────────────────

const GROUPS: Array<{ label: string; prefixes: string[] }> = [
  { label: "Public — exposed to browser", prefixes: ["NEXT_PUBLIC_"] },
  { label: "Supabase / Auth", prefixes: ["SUPABASE_", "PORTAL_"] },
  { label: "Email — Resend", prefixes: ["RESEND_"] },
  { label: "AI — OpenAI", prefixes: ["OPENAI_"] },
  { label: "Verifactu (AEAT)", prefixes: ["VERIFACTU_"] },
  { label: "CRM / Landing", prefixes: ["LEAD_", "LANDING_", "CAL_"] },
  { label: "Meta Marketing", prefixes: ["META_", "INSTAGRAM_", "FACEBOOK_"] },
  { label: "LinkedIn", prefixes: ["LINKEDIN_"] },
  { label: "GitHub App", prefixes: ["GITHUB_"] },
  { label: "n8n Automation", prefixes: ["N8N_"] },
  { label: "File Browser / Backups", prefixes: ["FILEBROWSER_", "BACKUP_"] },
  { label: "Payments — Redsys", prefixes: ["REDSYS_"] },
  { label: "Logging", prefixes: ["LOG_"] },
];

// ── Build output ──────────────────────────────────────────────────────────────

const allShape = ServerSchema.shape;
const assigned = new Set<string>();
const lines: string[] = [
  "# .env.example — auto-generated from lib/env.schema.ts",
  "# Regenerate: pnpm env:example",
  "# REQUIRED fields have no default and MUST be set.",
  "# Fields with a default value don't need to be set unless overriding.",
  "",
];

for (const { label, prefixes } of GROUPS) {
  const keys = Object.keys(allShape).filter(
    (k) => prefixes.some((p) => k.startsWith(p)) && !assigned.has(k),
  );
  if (keys.length === 0) continue;

  lines.push(`# ─── ${label} ${"─".repeat(Math.max(0, 55 - label.length))}`);
  for (const key of keys) {
    lines.push(formatLine(key, describeField(allShape[key] as z.ZodTypeAny)));
    assigned.add(key);
  }
  lines.push("");
}

// Leftover (ungrouped) fields
const rest = Object.keys(allShape).filter((k) => !assigned.has(k));
if (rest.length > 0) {
  lines.push("# ─── Other ───────────────────────────────────────────────────");
  for (const key of rest) {
    lines.push(formatLine(key, describeField(allShape[key] as z.ZodTypeAny)));
  }
  lines.push("");
}

const output = lines.join("\n");
const dest = resolve(root, ".env.example");
writeFileSync(dest, output, "utf-8");
console.log(`✓ Generated ${dest}`);
