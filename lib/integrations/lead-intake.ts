import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { z } from "zod";
import { runLeadPipeline } from "./lead-pipeline";
import { notifyNewLead } from "./notify-new-lead";

// ── Input schema ──────────────────────────────────────────────────────────

const utmSchema = z.object({
  source: z.string().optional().nullable(),
  medium: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
  term: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
});

const contextSchema = z.object({
  referrer: z.string().optional().nullable(),
  ip: z.string().optional().nullable(),
  device: z.string().optional().nullable(),
  browser: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
});

/**
 * Validated schema for ingestLead() inputs.
 * Adapters (Meta, Recurrev, landing, manual) translate provider-specific
 * payloads into this shape so the storage layer stays agnostic.
 * Exporting lets adapters reuse it for unit tests.
 */
export const LeadIntakeSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.string().email("invalid email").optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  source: z.string().trim().min(1, "source is required"),
  /** Provider-side stable identifier (e.g. Meta leadgen_id). Used for idempotency. */
  externalId: z.string().optional().nullable(),
  /** Provider key. Must match externalId namespace, e.g. "meta_lead_ads". */
  externalSource: z.string().optional().nullable(),
  utm: utmSchema.optional(),
  context: contextSchema.optional(),
  /** Raw provider payload for audit / debugging. Stored as jsonb. */
  rawPayload: z.unknown().optional(),
});

export type LeadIntake = z.infer<typeof LeadIntakeSchema>;

export type LeadIntakeResult =
  | { ok: true; leadId: string; duplicate: boolean }
  | { ok: false; error: string };

const log = scopedLogger("lead-intake");

/** Window for email/phone soft-dedupe when no externalId is present. */
const SOFT_DEDUPE_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function ingestLead(input: LeadIntake): Promise<LeadIntakeResult> {
  // ── 1. Validate & normalize ────────────────────────────────────────────
  const parsed = LeadIntakeSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "invalid input";
    log.warn({ errors: parsed.error.errors }, "ingestLead validation failed");
    return { ok: false, error: firstError };
  }
  const norm = parsed.data;

  const supabase = createAdminClient();

  // ── 2. Idempotency: externalId dedupe ──────────────────────────────────
  if (norm.externalId && norm.externalSource) {
    const { data: existing, error: lookupErr } = await supabase
      .from("leads")
      .select("id")
      .eq("external_source", norm.externalSource)
      .eq("external_id", norm.externalId)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupErr) {
      log.error({ err: lookupErr }, "lead lookup failed");
      return { ok: false, error: lookupErr.message };
    }
    if (existing?.id) {
      return { ok: true, leadId: existing.id as string, duplicate: true };
    }
  }

  // ── 3. Soft dedupe: same email or phone within 48 h (no externalId) ────
  if (!norm.externalId) {
    const cutoff = new Date(Date.now() - SOFT_DEDUPE_WINDOW_MS).toISOString();

    if (norm.email) {
      const { data: byEmail } = await supabase
        .from("leads")
        .select("id")
        .eq("email", norm.email)
        .is("deleted_at", null)
        .gte("created_at", cutoff)
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) {
        log.info({ leadId: byEmail.id }, "soft-dedupe hit by email");
        return { ok: true, leadId: byEmail.id as string, duplicate: true };
      }
    } else if (norm.phone) {
      const { data: byPhone } = await supabase
        .from("leads")
        .select("id")
        .eq("phone", norm.phone)
        .is("deleted_at", null)
        .gte("created_at", cutoff)
        .limit(1)
        .maybeSingle();
      if (byPhone?.id) {
        log.info({ leadId: byPhone.id }, "soft-dedupe hit by phone");
        return { ok: true, leadId: byPhone.id as string, duplicate: true };
      }
    }
  }

  // ── 4. Insert ──────────────────────────────────────────────────────────
  const row = {
    name: norm.name.trim().slice(0, 160),
    email: norm.email?.trim() || null,
    phone: norm.phone?.trim() || null,
    company: norm.company?.trim() || null,
    notes: norm.notes?.trim() || null,
    source: norm.source.trim().slice(0, 80),
    external_id: norm.externalId ?? null,
    external_source: norm.externalSource ?? null,
    utm_source: norm.utm?.source ?? null,
    utm_medium: norm.utm?.medium ?? null,
    utm_campaign: norm.utm?.campaign ?? null,
    utm_term: norm.utm?.term ?? null,
    utm_content: norm.utm?.content ?? null,
    referrer: norm.context?.referrer ?? null,
    ip: norm.context?.ip ?? null,
    device: norm.context?.device ?? null,
    browser: norm.context?.browser ?? null,
    language: norm.context?.language ?? null,
    raw_payload: (norm.rawPayload ?? null) as Record<string, unknown> | null,
  };

  const { data, error } = await supabase.from("leads").insert(row).select("id").single();

  if (error || !data) {
    // Race condition: another concurrent webhook delivery beat us. Re-fetch.
    if (error?.code === "23505" && norm.externalId && norm.externalSource) {
      const { data: dup } = await supabase
        .from("leads")
        .select("id")
        .eq("external_source", norm.externalSource)
        .eq("external_id", norm.externalId)
        .maybeSingle();
      if (dup?.id) return { ok: true, leadId: dup.id as string, duplicate: true };
    }
    log.error({ err: error }, "lead insert failed");
    return { ok: false, error: error?.message ?? "insert failed" };
  }

  const leadId = data.id as string;
  log.info({ leadId, source: row.source, externalSource: row.external_source }, "lead ingested");

  // ── 5 & 6. Background work (scored, auto-assigned, notified) ───────────────
  // Scheduled with `after()` so it is guaranteed to run once the response has
  // been sent. A bare fire-and-forget promise is torn down with the Route
  // Handler before it completes, which silently dropped notifications/emails.
  after(async () => {
    await Promise.allSettled([
      runLeadPipeline(leadId, norm).catch((e) => log.error({ err: e }, "lead pipeline failed")),
      notifyNewLead({
        leadId,
        leadName: row.name,
        leadEmail: row.email,
        leadPhone: row.phone,
        leadCompany: row.company,
        leadSource: row.source,
      }).catch((e) => log.error({ err: e }, "notifyNewLead failed")),
    ]);
  });

  return { ok: true, leadId, duplicate: false };
}
