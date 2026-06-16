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
  // Block protocol-relative URLs like //evil.com (startsWith("/") passes but
  // resolves to an external origin when fed to new URL()).
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/inicio";

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

  // exchangeCodeForSession always creates a fresh session for the recovery
  // link's recipient, overwriting any existing session in the cookies. We
  // must NOT call signOut() here first: signOut clears the PKCE code-verifier
  // cookie that @supabase/ssr stored when the browser called
  // resetPasswordForEmail / inviteUserByEmail, so the exchange would fail
  // immediately with an "invalid code verifier" error and the user would land
  // on /login with a spurious "session expired" message.
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    log.error({ err: error }, "exchangeCodeForSession failed");
    return NextResponse.redirect(new URL("/login?error=callback_exchange_failed", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
