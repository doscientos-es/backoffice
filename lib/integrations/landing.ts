import { type LeadIntake, parseBudgetFloor } from "@/lib/integrations/lead-intake";
import { optionalEmail, optionalText, requiredText } from "@/lib/schemas/common";
import { z } from "zod";

/**
 * Validation schema for the public landing contact form.
 *
 * Reuses the shared primitives so empty optional inputs ("") collapse to
 * `undefined` exactly like the rest of the app's form schemas. Every text
 * field is length-capped to keep the public endpoint cheap to abuse.
 */
export const LandingLeadInput = z.object({
  name: requiredText(160, "El nombre es obligatorio"),
  email: optionalEmail,
  phone: optionalText(40),
  company: optionalText(160),
  message: optionalText(4000),
  budget: optionalText(80),
  companySize: optionalText(80),
  // Attribution (the landing forwards these from the URL / first-touch cookie).
  utm_source: optionalText(200),
  utm_medium: optionalText(200),
  utm_campaign: optionalText(200),
  utm_term: optionalText(200),
  utm_content: optionalText(200),
  referrer: optionalText(500),
  language: optionalText(16),
  /**
   * Optional client-generated idempotency key (e.g. a UUID stored in the form
   * session). When present, double submits dedupe via ingestLead() instead of
   * creating duplicate leads. When absent, every submit creates a new lead.
   */
  dedupeKey: optionalText(120),
  /** Honeypot: must stay empty. Real users never see it; bots fill it. */
  website: optionalText(200),
});

export type LandingLeadInputType = z.infer<typeof LandingLeadInput>;

/** Minimal device classification from the User-Agent header. */
function deviceFromUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
}

/**
 * Translate a validated landing form submission into the generic LeadIntake
 * shape consumed by the storage layer. Keeps the endpoint thin and the mapping
 * unit-testable in isolation (mirrors the Meta / Recurrev adapters).
 */
export function mapLandingToIntake(
  input: LandingLeadInputType,
  ctx?: { ip?: string | null; userAgent?: string | null },
): LeadIntake {
  const notesParts = [
    input.message ?? null,
    input.companySize ? `Tamaño de empresa: ${input.companySize}` : null,
    input.budget ? `Presupuesto: ${input.budget}` : null,
  ].filter((v): v is string => Boolean(v));

  const dedupeKey = input.dedupeKey ?? null;
  const ua = ctx?.userAgent ?? null;

  return {
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company: input.company ?? null,
    notes: notesParts.length ? notesParts.join("\n") : null,
    estimatedValue: parseBudgetFloor(input.budget),
    source: "landing",
    externalId: dedupeKey,
    externalSource: dedupeKey ? "landing_form" : null,
    utm: {
      source: input.utm_source ?? null,
      medium: input.utm_medium ?? null,
      campaign: input.utm_campaign ?? null,
      term: input.utm_term ?? null,
      content: input.utm_content ?? null,
    },
    context: {
      referrer: input.referrer ?? null,
      ip: ctx?.ip ?? null,
      device: deviceFromUserAgent(ua),
      browser: ua,
      language: input.language ?? null,
    },
    rawPayload: input,
  };
}
