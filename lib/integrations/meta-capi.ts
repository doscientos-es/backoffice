import { isDemoMode } from "@/lib/demo";
import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import crypto from "node:crypto";

/**
 * Meta Conversions API (server-side events).
 *
 * Sends conversion events to Meta so the ad algorithm can optimise for
 * actual business outcomes (client acquired, invoice paid) instead of just
 * form fills. Errors never throw — callers should invoke fire-and-forget.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

const log = scopedLogger("meta-capi");
const CAPI_VERSION = "v19.0";

function sha256hex(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  // Keep only digits; Meta expects E.164 without leading +
  return phone.replace(/\D/g, "");
}

export type CapiConversionInput = {
  /**
   * `Lead`    — fired when lead is converted to client (primary signal).
   * `Purchase` — fired when an invoice is marked paid (highest-value signal).
   */
  eventName: "Lead" | "Purchase";
  /**
   * Deduplication key. Use `${eventName}-${leadId}` for backend-only events.
   * For events that also fire client-side via the Pixel (e.g. a form submit
   * tracked by both `fbq('track','Lead',...)` and this server call), reuse
   * the same session `event_id` the browser sent so Meta merges the two into
   * a single event instead of double-counting.
   */
  eventId: string;
  email?: string | null;
  phone?: string | null;
  /** Estimated deal value in EUR for bid optimization. */
  value?: number | null;
  currency?: string;
  /**
   * Where the event originated. Defaults to `"crm"` for internal backoffice
   * actions (e.g. manually converting a lead to a client). Use `"website"`
   * for events captured from a public form submission — pair it with
   * `eventSourceUrl`/`clientIpAddress`/`clientUserAgent` for better match
   * quality and to dedup correctly against the browser Pixel event.
   */
  actionSource?: "website" | "crm";
  /** Full URL of the page where the event happened. Expected by Meta for `"website"` events. */
  eventSourceUrl?: string | null;
  /** Raw request IP — improves Advanced Matching. */
  clientIpAddress?: string | null;
  /** Raw `User-Agent` header — improves Advanced Matching. */
  clientUserAgent?: string | null;
};

/**
 * Push one conversion event to Meta CAPI.
 * No-ops silently when META_PIXEL_ID or META_CAPI_ACCESS_TOKEN is not set.
 */
export async function pushMetaConversion(input: CapiConversionInput): Promise<void> {
  if (isDemoMode()) {
    log.debug({ eventId: input.eventId }, "meta capi mocked in demo mode");
    return;
  }

  const { META_PIXEL_ID, META_CAPI_ACCESS_TOKEN } = serverEnv();

  if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) {
    log.debug("meta capi not configured, skipping");
    return;
  }

  // Hashed user data — Meta requires lowercase, trimmed, SHA-256.
  const userData: Record<string, string | string[]> = {};
  if (input.email) {
    userData.em = [sha256hex(input.email)];
  }
  if (input.phone) {
    const normalized = normalizePhone(input.phone);
    if (normalized) userData.ph = [sha256hex(normalized)];
  }

  // Meta requires at least one user_data field. em/ph are what actually let
  // Meta match the event to a person, so we gate on those specifically —
  // IP/UA alone are too weak a signal to justify sending the event.
  if (!userData.em && !userData.ph) {
    log.debug({ eventId: input.eventId }, "meta capi: no user data available, skipping");
    return;
  }

  // Not hashed — Meta uses these as-is for Advanced Matching.
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: input.actionSource ?? "crm",
        event_source_url: input.eventSourceUrl ?? undefined,
        user_data: userData,
        custom_data:
          input.value != null
            ? { value: input.value, currency: input.currency ?? "EUR" }
            : undefined,
      },
    ],
  };

  const url = `https://graph.facebook.com/${CAPI_VERSION}/${META_PIXEL_ID}/events?access_token=${META_CAPI_ACCESS_TOKEN}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      log.warn({ status: res.status, error: body.error }, "meta_capi_error");
      return;
    }

    log.info({ events_received: body.events_received, eventId: input.eventId }, "meta_capi_sent");
  } catch (e) {
    log.warn({ err: e }, "meta_capi_fetch_failed");
  }
}
