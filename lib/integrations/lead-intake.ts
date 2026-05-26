import { createAdminClient } from "@/lib/supabase/admin";
import { scopedLogger } from "@/lib/logger";

/**
 * Normalized payload accepted by ingestLead().
 * Adapters (Meta, Google Ads, landing form, Tally...) translate provider-specific
 * payloads into this shape so the storage layer stays agnostic.
 */
export type LeadIntake = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  source: string;
  /** Provider-side stable identifier (e.g. Meta leadgen_id). Used for idempotency. */
  externalId?: string | null;
  /** Provider key. Must match externalId namespace, e.g. "meta_lead_ads". */
  externalSource?: string | null;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
  };
  context?: {
    referrer?: string | null;
    ip?: string | null;
    device?: string | null;
    browser?: string | null;
    language?: string | null;
  };
  /** Raw provider payload for audit / debugging. Stored as jsonb. */
  rawPayload?: unknown;
};

export type LeadIntakeResult =
  | { ok: true; leadId: string; duplicate: boolean }
  | { ok: false; error: string };

const log = scopedLogger("lead-intake");

export async function ingestLead(input: LeadIntake): Promise<LeadIntakeResult> {
  if (!input.name?.trim()) {
    return { ok: false, error: "name is required" };
  }

  const supabase = createAdminClient();

  // Idempotency: if we already stored this external lead, return the existing id.
  if (input.externalId && input.externalSource) {
    const { data: existing, error: lookupErr } = await supabase
      .from("leads")
      .select("id")
      .eq("external_source", input.externalSource)
      .eq("external_id", input.externalId)
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

  const row = {
    name: input.name.trim().slice(0, 160),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    company: input.company?.trim() || null,
    notes: input.notes?.trim() || null,
    source: input.source.trim().slice(0, 80),
    external_id: input.externalId ?? null,
    external_source: input.externalSource ?? null,
    utm_source: input.utm?.source ?? null,
    utm_medium: input.utm?.medium ?? null,
    utm_campaign: input.utm?.campaign ?? null,
    utm_term: input.utm?.term ?? null,
    utm_content: input.utm?.content ?? null,
    referrer: input.context?.referrer ?? null,
    ip: input.context?.ip ?? null,
    device: input.context?.device ?? null,
    browser: input.context?.browser ?? null,
    language: input.context?.language ?? null,
    raw_payload: (input.rawPayload ?? null) as Record<string, unknown> | null,
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    // Race condition: another concurrent webhook delivery beat us. Re-fetch.
    if (
      error?.code === "23505" &&
      input.externalId &&
      input.externalSource
    ) {
      const { data: dup } = await supabase
        .from("leads")
        .select("id")
        .eq("external_source", input.externalSource)
        .eq("external_id", input.externalId)
        .maybeSingle();
      if (dup?.id) return { ok: true, leadId: dup.id as string, duplicate: true };
    }
    log.error({ err: error }, "lead insert failed");
    return { ok: false, error: error?.message ?? "insert failed" };
  }

  log.info(
    { leadId: data.id, source: row.source, externalSource: row.external_source },
    "lead ingested",
  );
  return { ok: true, leadId: data.id as string, duplicate: false };
}
