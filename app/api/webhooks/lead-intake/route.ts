import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { ingestLead } from "@/lib/integrations/lead-intake";
import { type RecurrevWebhookPayload, mapRecurrevToIntake } from "@/lib/integrations/recurrev";
import { scopedLogger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("lead-intake-webhook");

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Constant-time string comparison to avoid token timing attacks. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * GET /api/webhooks/lead-intake
 * Simple health check to verify endpoint is live.
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Lead intake webhook is live. Use POST to submit leads.",
  });
}

/**
 * POST /api/webhooks/lead-intake
 *
 * Generic endpoint for CRM integrations that can send a custom webhook.
 * Currently used by Recurrev (GoHighLevel) via "Webhook personalizado" action.
 *
 * Auth: Authorization: Bearer <LEAD_INTAKE_TOKEN>
 */
export async function POST(request: NextRequest) {
  const env = serverEnv();

  if (!env.LEAD_INTAKE_TOKEN) {
    log.warn("LEAD_INTAKE_TOKEN not configured");
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  // Verify Bearer token
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();

  if (!token || !safeEqual(token, env.LEAD_INTAKE_TOKEN)) {
    log.warn({ tokenProvided: Boolean(token) }, "invalid token");
    return unauthorized();
  }

  let payload: RecurrevWebhookPayload;
  try {
    payload = (await request.json()) as RecurrevWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  const intake = mapRecurrevToIntake(payload, clientIp);
  const result = await ingestLead(intake);

  if (!result.ok) {
    log.error({ error: result.error }, "ingestLead failed");
    // Still 200 so the CRM doesn't retry and flood us
    return NextResponse.json({ ok: false, error: result.error, partial: true });
  }

  return NextResponse.json({
    ok: true,
    leadId: result.leadId,
    duplicate: result.duplicate,
  });
}
