import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

const log = scopedLogger("auth.callback");

/**
 * PKCE callback for Supabase Auth.
 *
 * Handles every link Supabase sends out: invitations, password recovery,
 * email confirmations and magic links. The provider redirects here with
 * `?code=<auth_code>` (and optionally `?next=/some/path`).
 *
 * Why this route exists:
 * Without an explicit `exchangeCodeForSession` step the auth code in the URL
 * is never traded for a session. The form pages that follow (e.g. the
 * update-password page) then run against *whatever session was already in
 * the browser cookies*, which leads to a user accidentally changing the
 * password of a different account if cookies for that account happened to
 * be alive. To eliminate that class of bug we ALWAYS `signOut()` any
 * pre-existing session before exchanging the code, so the resulting
 * session is guaranteed to belong to the link's recipient.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const rawNext = url.searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/inicio";

  if (errorParam) {
    log.warn({ errorParam }, "callback received provider error");
    return NextResponse.redirect(
      new URL(`/login?error=callback_${encodeURIComponent(errorParam)}`, request.url),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback_no_code", request.url));
  }

  const supabase = await createServerClient();

  // Critical: scrub any pre-existing browser session before processing the
  // token. If a teammate clicks an invite link in a browser where another
  // user's cookies are still active, the next `updateUser({ password })`
  // call would otherwise rewrite that user's password.
  await supabase.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    log.error({ err: error }, "exchangeCodeForSession failed");
    return NextResponse.redirect(new URL("/login?error=callback_exchange_failed", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
