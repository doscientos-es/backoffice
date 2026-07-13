import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";
import { z } from "zod";

const log = scopedLogger("conversion-events");

export const ConversionEventInput = z.object({
  event_id: z.string().trim().max(120).optional().nullable(),
  visitor_id: z.string().trim().max(120).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  event_name: z.string().trim().min(1).max(120),
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

export function normalizeOrigin(value: string): string {
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function allowedOrigins(): string[] {
  return serverEnv().LANDING_ALLOWED_ORIGINS.split(",").map(normalizeOrigin).filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  const allowed = allowedOrigins();
  return allowed.includes("*") || !origin || allowed.includes(normalizeOrigin(origin));
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  const allowed = allowedOrigins();
  if (allowed.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && allowed.includes(normalizeOrigin(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

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
  const filters: string[] = [];
  if (input.visitorId) filters.push(`visitor_id.eq.${input.visitorId}`);
  if (input.eventId) filters.push(`event_id.eq.${input.eventId}`);
  if (filters.length === 0) return;

  const query = supabase
    .from("conversion_events")
    .update({ lead_id: input.leadId })
    .is("lead_id", null);

  const { error } = await query.or(filters.join(","));
  if (error) {
    log.warn({ err: error, leadId: input.leadId }, "conversion events link failed");
  }
}
