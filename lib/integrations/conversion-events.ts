import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";
import { z } from "zod";

const log = scopedLogger("conversion-events");

export const CONVERSION_EVENT_NAMES = ["whatsapp_click", "lead_created"] as const;

export const ConversionEventInput = z.object({
  event_id: z.string().trim().max(120).optional().nullable(),
  visitor_id: z.string().trim().max(120).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  event_name: z.enum(CONVERSION_EVENT_NAMES),
  conversion_step: z.string().trim().max(120).optional().nullable(),
  landing_path: z.string().trim().max(500).optional().nullable(),
  landing_ref: z.string().trim().max(200).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  utm_source: z.string().trim().max(200).optional().nullable(),
  utm_medium: z.string().trim().max(200).optional().nullable(),
  utm_campaign: z.string().trim().max(200).optional().nullable(),
  utm_term: z.string().trim().max(200).optional().nullable(),
  utm_content: z.string().trim().max(200).optional().nullable(),
  payload: z.record(z.unknown()).optional().nullable(),
});

export type ConversionEventInputType = z.infer<typeof ConversionEventInput>;

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function recordConversionEvent(
  input: ConversionEventInputType,
  ctx: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const payload = {
    event_id: input.event_id || null,
    visitor_id: input.visitor_id || null,
    lead_id: input.lead_id || null,
    event_name: input.event_name,
    conversion_step: input.conversion_step || null,
    landing_path: input.landing_path || null,
    landing_ref: input.landing_ref || null,
    referrer: input.referrer || null,
    utm_source: input.utm_source || null,
    utm_medium: input.utm_medium || null,
    utm_campaign: input.utm_campaign || null,
    utm_term: input.utm_term || null,
    utm_content: input.utm_content || null,
    ip: ctx.ip ?? null,
    user_agent: ctx.userAgent ?? null,
    payload: input.payload ?? null,
  };

  const { error } = await createAdminClient().from("conversion_events").insert(payload);
  if (error) {
    log.warn({ err: error, eventName: input.event_name }, "conversion event insert failed");
  }
}

export async function linkConversionEventsToLead(input: {
  leadId: string;
  visitorId?: string | null;
  eventId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  let linkedByEventId = false;

  if (input.eventId) {
    const { data, error } = await supabase
      .from("conversion_events")
      .update({ lead_id: input.leadId })
      .eq("event_id", input.eventId)
      .eq("event_name", "whatsapp_click")
      .is("lead_id", null)
      .select("id");
    if (error) {
      log.warn({ err: error, leadId: input.leadId }, "conversion event link failed");
    } else {
      linkedByEventId = (data?.length ?? 0) > 0;
    }
  }

  // visitor_id is only a fallback for a WhatsApp click from another browser
  // session. Refuse ambiguous matches so one visitor cannot attach an entire
  // browsing history to a later lead.
  if (linkedByEventId || !input.visitorId) return;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error: lookupError } = await supabase
    .from("conversion_events")
    .select("id")
    .eq("visitor_id", input.visitorId)
    .eq("event_name", "whatsapp_click")
    .is("lead_id", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(2);

  if (lookupError) {
    log.warn({ err: lookupError, leadId: input.leadId }, "conversion event lookup failed");
    return;
  }
  const candidate = candidates?.length === 1 ? candidates[0] : null;
  if (!candidate) return;

  const { error } = await supabase
    .from("conversion_events")
    .update({ lead_id: input.leadId })
    .eq("id", candidate.id)
    .is("lead_id", null);
  if (error) {
    log.warn({ err: error, leadId: input.leadId }, "fallback conversion event link failed");
  }
}
