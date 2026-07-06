import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import {
  type FormAnswer,
  type LeadIntake,
  classifyFormAnswers,
  parseBudgetFloor,
} from "@/lib/integrations/lead-intake";
import { scopedLogger } from "@/lib/logger";

const log = scopedLogger("meta-leads");

export const META_LEAD_SOURCE = "meta_lead_ads";

/**
 * Meta sends a JSON body and signs it with HMAC-SHA256 using the App Secret.
 * Header format: `X-Hub-Signature-256: sha256=<hex>`.
 * Doc: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 */
export function verifyMetaSignature(
  appSecret: string,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature || !appSecret) return false;
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------- Graph API types ----------------

export type MetaLeadgenChange = {
  value: {
    leadgen_id: string;
    page_id: string;
    form_id: string;
    ad_id?: string;
    adgroup_id?: string;
    created_time?: number;
  };
  field: "leadgen";
};

export type MetaWebhookPayload = {
  object: "page";
  entry: Array<{
    id: string;
    time: number;
    changes: MetaLeadgenChange[];
  }>;
};

export type MetaLeadField = { name: string; values: string[] };

export type MetaLeadgenResponse = {
  id: string;
  created_time: string;
  field_data: MetaLeadField[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
  platform?: string;
  is_organic?: boolean;
};

/**
 * Fetch full lead data from the Graph API using the page access token.
 * Field names are localized to the form's language, so we read by common keys
 * AND fall back to fuzzy matching in mapMetaLeadgenToIntake().
 */
export async function fetchMetaLeadgen(leadgenId: string): Promise<MetaLeadgenResponse> {
  const env = serverEnv();
  if (!env.META_PAGE_ACCESS_TOKEN) {
    throw new Error("META_PAGE_ACCESS_TOKEN not configured");
  }
  const url = new URL(
    `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${encodeURIComponent(leadgenId)}`,
  );
  url.searchParams.set(
    "fields",
    "id,created_time,field_data,ad_id,adset_id,campaign_id,form_id,platform,is_organic",
  );
  url.searchParams.set("access_token", env.META_PAGE_ACCESS_TOKEN);

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as MetaLeadgenResponse;
}

// ---------------- Field mapping ----------------

const FIELD_ALIASES = {
  email: ["email", "correo_electronico", "correo", "e-mail"],
  phone: ["phone_number", "phone", "telefono", "teléfono", "tel"],
  fullName: ["full_name", "nombre_completo", "name", "nombre"],
  firstName: ["first_name", "nombre"],
  lastName: ["last_name", "apellidos", "apellido"],
  company: ["company_name", "empresa", "company", "organizacion"],
  urgency: ["urgency", "urgencia", "cuando_necesitas_empezar", "plazo", "priority"],
} as const;

function findField(fields: MetaLeadField[], candidates: ReadonlyArray<string>): string | null {
  const normalized = fields.map((f) => ({
    key: f.name.toLowerCase().trim(),
    value: f.values?.[0] ?? null,
  }));
  for (const c of candidates) {
    const hit = normalized.find((n) => n.key === c);
    if (hit?.value) return hit.value;
  }
  return null;
}

/**
 * Extracts custom form questions from Meta field_data as label/value pairs.
 * Spanish forms use "¿…?" as the question pattern. The pairs feed both the
 * human-readable `notes` block and the structured classifier
 * (classifyFormAnswers) that fills the qualification columns.
 */
function extractMetaFormAnswers(fields: MetaLeadField[]): FormAnswer[] {
  const answers: FormAnswer[] = [];
  for (const field of fields) {
    const key = field.name.trim();
    if (!key.startsWith("¿")) continue;
    const value = field.values?.[0]?.trim();
    if (!value) continue;
    const label = key
      .replace(/^¿/, "")
      .replace(/\?\s*$/, "")
      .trim();
    answers.push({ label, value });
  }
  return answers;
}

/** Renders extracted answers into the human-readable `notes` block. */
function formAnswersToNotes(answers: FormAnswer[]): string | null {
  return answers.length > 0 ? answers.map((a) => `${a.label}: ${a.value}`).join("\n") : null;
}

/**
 * Locates the "presupuesto" answer among the Meta field_data and delegates the
 * numeric parsing to the shared parseBudgetFloor() helper.
 */
function parseMetaBudgetToEstimatedValue(fields: MetaLeadField[]): number | null {
  for (const field of fields) {
    if (!field.name.toLowerCase().includes("presupuesto")) continue;
    const parsed = parseBudgetFloor(field.values?.[0]);
    if (parsed !== null) return parsed;
  }
  return null;
}

/** Converts a Graph API leadgen response into our generic LeadIntake shape. */
export function mapMetaLeadgenToIntake(
  res: MetaLeadgenResponse,
  webhookCtx?: { pageId?: string; createdTime?: number },
): LeadIntake {
  const fullName =
    findField(res.field_data, FIELD_ALIASES.fullName) ||
    [
      findField(res.field_data, FIELD_ALIASES.firstName),
      findField(res.field_data, FIELD_ALIASES.lastName),
    ]
      .filter(Boolean)
      .join(" ") ||
    "Lead sin nombre";

  const formAnswers = extractMetaFormAnswers(res.field_data);
  const qualification = classifyFormAnswers(formAnswers);
  const explicitUrgency = findField(res.field_data, FIELD_ALIASES.urgency);

  return {
    name: fullName,
    email: findField(res.field_data, FIELD_ALIASES.email),
    phone: findField(res.field_data, FIELD_ALIASES.phone),
    company: findField(res.field_data, FIELD_ALIASES.company),
    notes: formAnswersToNotes(formAnswers),
    estimatedValue: parseMetaBudgetToEstimatedValue(res.field_data),
    companySize: qualification.companySize,
    solutionType: qualification.solutionType,
    urgency: explicitUrgency || qualification.urgency,
    source: META_LEAD_SOURCE,
    externalId: res.id,
    externalSource: META_LEAD_SOURCE,
    utm: {
      source: "facebook",
      medium: "paid_social",
      campaign: res.campaign_id ?? null,
      content: res.ad_id ?? null,
      term: res.adset_id ?? null,
    },
    context: { referrer: res.platform ?? "facebook" },
    rawPayload: { ...res, webhookCtx: webhookCtx ?? null },
  };
}

export function logMetaError(msg: string, extra?: Record<string, unknown>): void {
  log.error(extra ?? {}, msg);
}
