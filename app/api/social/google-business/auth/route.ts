import { randomBytes } from "node:crypto";
/**
 * GET /api/social/google-business/auth
 *
 * Starts the Google Business Profile offline OAuth flow. Only team admins can
 * start it because the resulting refresh token can publish to the business.
 */
import { requireRole } from "@/lib/auth";
import {
  googleBusinessAuthorizationUrl,
  googleBusinessOAuthConfigured,
} from "@/lib/social/google-business";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "google_business_oauth_state";
const STATE_TTL_S = 600;

export async function GET(_req: NextRequest) {
  try {
    await requireRole(["owner", "admin"]);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!googleBusinessOAuthConfigured()) {
    return NextResponse.json({ error: "google_business_not_configured" }, { status: 503 });
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(googleBusinessAuthorizationUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_TTL_S,
    path: "/",
  });
  return response;
}
