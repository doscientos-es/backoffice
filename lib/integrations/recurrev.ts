import { type LeadIntake, parseBudgetFloor } from "@/lib/integrations/lead-intake";

/**
 * Shape of the JSON body that Recurrev (GoHighLevel) sends via "Webhook personalizado".
 * Fields are optional/nullable because GHL only sends what it has.
 */
export type RecurrevWebhookPayload = {
  // Contact identity
  external_id?: string;
  contact_id?: string;
  id?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  company_name?: string;
  notes?: string;

  // Source
  source?: string;

  // UTM / attribution (GHL sends these via {{contact.attributionSource.*}})
  utm_source?: string;
  utmSource?: string;
  utm_medium?: string;
  utmMedium?: string;
  utm_campaign?: string;
  utmCampaign?: string;
  utm_content?: string;
  utmContent?: string;
  utm_term?: string;
  utmTerm?: string;
  referrer?: string;

  // Meta Ads attribution (GHL exposes these on the contact)
  ad_id?: string;
  adId?: string;
  adset_id?: string;
  adGroupId?: string;
  campaign_id?: string;
  campaignId?: string;

  // Allow arbitrary extra fields (stored in rawPayload)
  [key: string]: unknown;
};

function pick(...values: (string | null | undefined)[]): string | null {
  return values.find((v) => typeof v === "string" && v.trim() !== "") ?? null;
}

/**
 * Extracts custom form questions from the Meta lead form.
 * GHL forwards the original Meta field labels verbatim as payload keys;
 * Spanish forms use "¿…?" as the question pattern, making them easy to detect.
 * Produces a human-readable block ready for the `notes` field, e.g.:
 *   Tamaño de empresa: 10-50 empleados
 *   Qué solución necesitas desarrollar: Software a Medida (CRM, ERP, etc)
 *   Presupuesto estimado: Más de 10.000€
 */
function extractFormQuestionsAsNotes(payload: RecurrevWebhookPayload): string | null {
  const lines: string[] = [];
  for (const [rawKey, value] of Object.entries(payload)) {
    const key = rawKey.trim(); // GHL occasionally appends trailing whitespace/tabs
    if (!key.startsWith("¿")) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    // "¿Tamaño de empresa?" → "Tamaño de empresa"
    const label = key
      .replace(/^¿/, "")
      .replace(/\?\s*$/, "")
      .trim();
    lines.push(`${label}: ${value.trim()}`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * Locates the "presupuesto" answer among the payload keys and delegates the
 * numeric parsing to the shared parseBudgetFloor() helper.
 */
function parseBudgetToEstimatedValue(payload: RecurrevWebhookPayload): number | null {
  for (const [rawKey, value] of Object.entries(payload)) {
    const key = rawKey.trim().toLowerCase();
    if (!key.includes("presupuesto")) continue;
    if (typeof value !== "string") continue;
    const parsed = parseBudgetFloor(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Map a Recurrev "Webhook personalizado" payload to the generic LeadIntake shape.
 * Tolerant: accepts camelCase and snake_case variants of every field.
 */
export function mapRecurrevToIntake(
  payload: RecurrevWebhookPayload,
  clientIp?: string,
): LeadIntake {
  // Resolve name: full_name > first+last > name fallback
  const fullName = pick(payload.full_name, payload.fullName, payload.name);
  const firstName = pick(payload.first_name, payload.firstName);
  const lastName = pick(payload.last_name, payload.lastName);
  const joinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const resolvedName = fullName ?? (joinedName || "Lead sin nombre");

  // Stable ID for idempotency (contact.id from GHL)
  const externalId = pick(payload.external_id, payload.contact_id, payload.id);

  // Combine manual notes with custom form questions extracted from the payload
  const manualNotes = pick(payload.notes);
  const formNotes = extractFormQuestionsAsNotes(payload);
  const combinedNotes = [manualNotes, formNotes].filter(Boolean).join("\n\n") || null;

  return {
    name: resolvedName,
    email: pick(payload.email) ?? null,
    phone: pick(payload.phone) ?? null,
    company: pick(payload.company, payload.companyName, payload.company_name) ?? null,
    notes: combinedNotes,
    estimatedValue: parseBudgetToEstimatedValue(payload),
    source: pick(payload.source) ?? "recurrev",
    externalId: externalId ?? null,
    externalSource: externalId ? "recurrev" : null,
    utm: {
      source: pick(payload.utm_source, payload.utmSource) ?? "facebook",
      medium: pick(payload.utm_medium, payload.utmMedium) ?? "paid_social",
      campaign:
        pick(payload.utm_campaign, payload.utmCampaign, payload.campaign_id, payload.campaignId) ??
        null,
      content: pick(payload.utm_content, payload.utmContent, payload.ad_id, payload.adId) ?? null,
      term: pick(payload.utm_term, payload.utmTerm, payload.adset_id, payload.adGroupId) ?? null,
    },
    context: {
      referrer: pick(payload.referrer) ?? null,
      ip: clientIp ?? null,
    },
    rawPayload: payload,
  };
}
