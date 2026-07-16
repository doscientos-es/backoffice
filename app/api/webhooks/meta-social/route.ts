import { serverEnv } from "@/lib/env";
import { verifyMetaSignature } from "@/lib/integrations/meta-leads";
import { scopedLogger } from "@/lib/logger";
import { processMetaCommentEvent } from "@/lib/social/automation/service";
import { parseMetaCommentEvents } from "@/lib/social/meta/webhook";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("meta-social-webhook");

/** Meta webhook handshake shared by Page and Instagram subscriptions. */
export async function GET(request: NextRequest) {
  const env = serverEnv();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    env.META_VERIFY_TOKEN &&
    mode === "subscribe" &&
    token === env.META_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

/** Receive comments, process automations, and acknowledge Meta deliveries. */
export async function POST(request: NextRequest) {
  const env = serverEnv();
  if (!env.META_APP_SECRET || !env.META_PAGE_ACCESS_TOKEN) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  if (!verifyMetaSignature(env.META_APP_SECRET, raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events = parseMetaCommentEvents(payload);
  const results = await Promise.allSettled(events.map(processMetaCommentEvent));
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    log.error({ failed, total: events.length }, "meta_social_webhook_partial_failure");
  }

  // Always acknowledge a valid signed event. Meta retries failed deliveries and
  // the run table provides idempotency for individual comment/rule pairs.
  return NextResponse.json({ ok: true, received: events.length, failed });
}
