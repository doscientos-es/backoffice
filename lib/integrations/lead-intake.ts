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
  /** Best-effort estimated pipeline value (e.g. parsed from a form budget range). */
  estimatedValue: z.number().min(0).max(99_999_999.99).optional().nullable(),
  /** Firmographic + intent signals parsed from the form (drive scoring/filtering). */
  companySize: z.string().optional().nullable(),
  solutionType: z.string().optional().nullable(),
  urgency: z.string().optional().nullable(),
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

/**
 * Parses a conservative numeric floor (EUR) from a free-text budget answer.
 * Meta / landing forms send ranges, not exact amounts, so we take the lowest
 * figure present to avoid overstating the pipeline value:
 *   "Más de 10.000€"    → 10000
 *   "Menos de 5.000€"   → 5000
 *   "5.000€ - 10.000€"  → 5000
 * Spanish uses "." as the thousands separator, which we strip before parsing.
 * Shared by every adapter (Recurrev, Meta, landing) so the mapping stays
 * identical regardless of how the lead reached us.
 */
export function parseBudgetFloor(text: string | null | undefined): number | null {
  if (!text || !text.trim()) return null;
  const amounts = (text.match(/\d[\d.]*/g) ?? [])
    .map((m) => Number.parseInt(m.replace(/\./g, ""), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return amounts.length > 0 ? Math.min(...amounts) : null;
}

/** Lowercases and strips Spanish accents so keyword matching is diacritic-safe. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** A question/answer pair extracted from a form ("¿Tamaño de empresa?" → "10-50"). */
export type FormAnswer = { label: string; value: string };

/**
 * Structured qualification signals derived from free-text form answers.
 * Both the Meta and Recurrev mappers feed their "¿…?" answers through here so
 * the same firmographic/intent data lands in dedicated columns regardless of
 * how the lead reached us — enabling scoring and Kanban filtering.
 */
export type QualificationFields = {
  companySize: string | null;
  solutionType: string | null;
  urgency: string | null;
};

export function classifyFormAnswers(answers: FormAnswer[]): QualificationFields {
  const out: QualificationFields = {
    companySize: null,
    solutionType: null,
    urgency: null,
  };
  for (const { label, value } of answers) {
    const v = value?.trim();
    if (!v) continue;
    const key = normalize(label);
    if (out.companySize == null && (key.includes("tamano") || key.includes("empleado"))) {
      out.companySize = v;
    } else if (
      // Urgency is evaluated before solutionType because time-related questions
      // ("¿Para cuándo necesitas tener el proyecto listo?") share the "necesitas"
      // and "proyecto" tokens with solution questions. Matching the temporal
      // signal first keeps classification order-independent.
      out.urgency == null &&
      (key.includes("cuando") ||
        key.includes("plazo") ||
        key.includes("urgen") ||
        key.includes("empezar") ||
        key.includes("inicio") ||
        key.includes("solucionar") ||
        key.includes("urgencia"))
    ) {
      out.urgency = v;
    } else if (
      out.solutionType == null &&
      (key.includes("solucion") || key.includes("necesitas") || key.includes("proyecto"))
    ) {
      out.solutionType = v;
    }
  }
  return out;
}

/**
 * Parses the lower employee count from a company-size answer, mirroring
 * parseBudgetFloor: "10-50 empleados" → 10, "Más de 200" → 200, "1-10" → 1.
 */
export function parseEmployeeFloor(text: string | null | undefined): number | null {
  if (!text || !text.trim()) return null;
  const counts = (text.match(/\d[\d.]*/g) ?? [])
    .map((m) => Number.parseInt(m.replace(/\./g, ""), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return counts.length > 0 ? Math.min(...counts) : null;
}

/** Maps a free-text urgency answer to a 0–1 intent weight for scoring. */
export function urgencyWeight(text: string | null | undefined): number {
  if (!text) return 0;
  const v = normalize(text);
  if (v.includes("inmediat") || v.includes("urgent") || /\bya\b/.test(v)) return 1;
  if (v.includes("mes")) return 0.7;
  if (v.includes("trimestre") || v.includes("3 mes")) return 0.4;
  if (v.includes("explor") || v.includes("solo informacion") || v.includes("sin prisa")) return 0.1;
  return 0;
}

/**
 * Window for email/phone soft-dedupe.
 * 7 days covers the typical landing-form → Cal.com booking gap where the
 * same person submits the contact form and then schedules a call days later.
 * Without this, both events would create separate leads and fire duplicate
 * notifications, because Cal.com always carries its own externalId (booking
 * uid) which is different from the landing-form dedupeKey.
 */
const log = scopedLogger("lead-intake");

const SOFT_DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

  // ── 3. Soft dedupe + enrich: same email or phone within window ─────────
  // Runs even when externalId is present so that cross-source flows (e.g.
  // landing form → Cal.com booking) map to the same lead. Instead of dropping
  // the second event, we merge whatever new context it carries into the
  // existing lead (filling gaps + appending notes) and suppress the duplicate
  // notification by returning `duplicate: true`.
  {
    const cutoff = new Date(Date.now() - SOFT_DEDUPE_WINDOW_MS).toISOString();

    let matchedId: string | null = null;
    if (norm.email) {
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("email", norm.email)
        .is("deleted_at", null)
        .gte("created_at", cutoff)
        .limit(1)
        .maybeSingle();
      if (data?.id) matchedId = data.id as string;
    } else if (norm.phone) {
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("phone", norm.phone)
        .is("deleted_at", null)
        .gte("created_at", cutoff)
        .limit(1)
        .maybeSingle();
      if (data?.id) matchedId = data.id as string;
    }

    if (matchedId) {
      await enrichLead(supabase, matchedId, norm).catch((e) =>
        log.error({ err: e, leadId: matchedId }, "lead enrich failed"),
      );
      log.info({ leadId: matchedId, source: norm.source }, "soft-dedupe hit, lead enriched");
      return { ok: true, leadId: matchedId, duplicate: true };
    }
  }

  // ── 4. Insert ──────────────────────────────────────────────────────────
  const row = {
    name: norm.name.trim().slice(0, 160),
    email: norm.email?.trim() || null,
    phone: norm.phone?.trim() || null,
    company: norm.company?.trim() || null,
    notes: norm.notes?.trim() || null,
    estimated_value: norm.estimatedValue ?? null,
    company_size: norm.companySize?.trim() || null,
    solution_type: norm.solutionType?.trim() || null,
    urgency: norm.urgency?.trim() || null,
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
        leadNotes: row.notes,
        leadEstimatedValue: row.estimated_value,
        leadCompanySize: row.company_size,
        leadUrgency: row.urgency,
      }).catch((e) => log.error({ err: e }, "notifyNewLead failed")),
    ]);
  });

  return { ok: true, leadId, duplicate: false };
}

/**
 * Non-destructive merge of a fresh intake into an already-existing lead.
 *
 * Used when soft-dedupe resolves a second submission (e.g. a Cal.com booking
 * after a landing-form contact) to the same person. Fills only the fields the
 * existing lead is still missing — first-touch attribution (`source`,
 * `external_*`, `name`) is preserved — and appends any new notes so the
 * combined context (phone from the form, meeting details from Cal.com, …) is
 * captured on a single lead. Never throws to the caller.
 */
async function enrichLead(
  supabase: ReturnType<typeof createAdminClient>,
  leadId: string,
  norm: LeadIntake,
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("leads")
    .select(
      "email, phone, company, notes, estimated_value, company_size, solution_type, urgency, decision_role, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, ip, device, browser, language",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (error || !existing) return;

  const updates: Record<string, unknown> = {};

  // Fill a column only when the existing lead has no value for it yet.
  const fillGap = (column: string, current: unknown, incoming: string | null | undefined) => {
    const value = incoming?.trim();
    if (value && !current) updates[column] = value;
  };

  fillGap("email", existing.email, norm.email);
  fillGap("phone", existing.phone, norm.phone);
  fillGap("company", existing.company, norm.company);
  fillGap("company_size", existing.company_size, norm.companySize);
  fillGap("solution_type", existing.solution_type, norm.solutionType);
  fillGap("urgency", existing.urgency, norm.urgency);
  fillGap("utm_source", existing.utm_source, norm.utm?.source);
  fillGap("utm_medium", existing.utm_medium, norm.utm?.medium);
  fillGap("utm_campaign", existing.utm_campaign, norm.utm?.campaign);
  fillGap("utm_term", existing.utm_term, norm.utm?.term);
  fillGap("utm_content", existing.utm_content, norm.utm?.content);
  fillGap("referrer", existing.referrer, norm.context?.referrer);
  fillGap("ip", existing.ip, norm.context?.ip);
  fillGap("device", existing.device, norm.context?.device);
  fillGap("browser", existing.browser, norm.context?.browser);
  fillGap("language", existing.language, norm.context?.language);

  // Numeric gap: only set the parsed budget when no value has been assigned yet.
  if (norm.estimatedValue != null && existing.estimated_value == null) {
    updates.estimated_value = norm.estimatedValue;
  }

  // Append incoming notes unless they are already present (guards retries).
  const incomingNotes = norm.notes?.trim();
  const currentNotes = (existing.notes as string | null) ?? "";
  if (incomingNotes && !currentNotes.includes(incomingNotes)) {
    updates.notes = currentNotes ? `${currentNotes}\n\n---\n${incomingNotes}` : incomingNotes;
  }

  if (Object.keys(updates).length === 0) return;

  updates.updated_at = new Date().toISOString();
  const { error: updateErr } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (updateErr) {
    log.error({ err: updateErr, leadId }, "enrichLead update failed");
  } else {
    log.info({ leadId, fields: Object.keys(updates) }, "lead enriched from duplicate intake");
  }
}
