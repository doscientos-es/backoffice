/**
 * GET /api/social/linkedin/auth
 *
 * Initiates the LinkedIn 3-legged OAuth 2.0 flow.
 * Generates a CSRF `state` token, stores it in a short-lived httpOnly cookie,
 * and redirects the user to LinkedIn's authorization endpoint.
 *
 * Required scopes (Community Management API):
 *   r_organization_social  — read posts, comments, reactions
 *   w_organization_social  — create / manage posts & comments
 */
import { randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("social-linkedin.auth");

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const STATE_COOKIE = "li_oauth_state";
const STATE_TTL_S = 600; // 10 minutes

const SCOPES = [
  "r_organization_social",
  "w_organization_social",
  "rw_organization_admin", // needed for analytics; omit if denied
].join(" ");

export async function GET(req: NextRequest) {
  const env = serverEnv();

  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_REDIRECT_URI) {
    log.warn("LinkedIn OAuth not configured — missing CLIENT_ID or REDIRECT_URI");
    return NextResponse.json({ error: "linkedin_not_configured" }, { status: 503 });
  }

  const state = randomBytes(16).toString("hex");

  const authUrl = new URL(LINKEDIN_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", env.LINKEDIN_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", env.LINKEDIN_REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);

  log.info({ state }, "Redirecting to LinkedIn OAuth");

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_TTL_S,
    path: "/",
  });

  return res;
}
