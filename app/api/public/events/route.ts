import {
  ConversionEventInput,
  clientIp,
  corsHeaders,
  isAllowedOrigin,
  recordConversionEvent,
} from "@/lib/integrations/conversion-events";
import { scopedLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("public-events");
const RATE_LIMIT = 120;

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);
  if (origin && !isAllowedOrigin(origin)) {
    log.warn({ origin }, "blocked event from disallowed origin");
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403, headers: cors });
  }

  const ip = clientIp(request);
  const rl = rateLimit(`public-events:${ip}`, RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: cors });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: cors });
  }

  const parsed = ConversionEventInput.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", issues: parsed.error.flatten() },
      { status: 400, headers: cors },
    );
  }

  await recordConversionEvent(parsed.data, {
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true }, { status: 202, headers: cors });
}
