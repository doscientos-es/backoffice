import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { getFollowUps } from "@/lib/integrations/follow-ups";
import { scopedLogger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("follow-ups");

/** Constant-time string comparison to avoid token timing attacks. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Parse a positive-integer query param, falling back to `fallback`. */
function intParam(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * GET /api/integrations/follow-ups
 *
 * Read-only feed for the n8n cron workflows. Returns the active leads that have
 * gone quiet and the proposals awaiting a client response, reusing the same
 * business rules as the dashboard.
 *
 * Auth: header `X-Webhook-Secret: <N8N_WEBHOOK_SECRET>`
 * Query: `leadHours` (default 24), `proposalHours` (default 72)
 */
export async function GET(request: NextRequest) {
  const env = serverEnv();

  if (!env.N8N_WEBHOOK_SECRET) {
    log.warn("N8N_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false, error: "endpoint not configured" }, { status: 503 });
  }

  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!provided || !safeEqual(provided, env.N8N_WEBHOOK_SECRET)) {
    log.warn({ secretProvided: Boolean(provided) }, "invalid webhook secret");
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leadHours = intParam(searchParams.get("leadHours"), 24);
  const proposalHours = intParam(searchParams.get("proposalHours"), 72);

  try {
    const data = await getFollowUps({ leadHours, proposalHours });
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    log.error({ err }, "failed to compute follow-ups");
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
