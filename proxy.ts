import { rateLimit } from "@/lib/ratelimit";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  // OTP confirmation for admin-generated tokens (team invitations). Must be
  // public so unauthenticated users can reach it without losing the token_hash.
  // Equivalent to /auth/callback in the PKCE flow.
  "/auth/confirm",
  "/api/webhooks",
  "/api/email/webhook",
  "/api/public",
  // Integration endpoints authenticate themselves via secrets; no session needed.
  "/api/integrations",
];

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public portal: /p/[type]/[token] is always public, rate-limited per IP
  if (pathname.startsWith("/p/")) {
    const ip = clientIp(request);
    const { success, resetAt } = rateLimit(`portal:${ip}`, 30);
    if (!success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
      });
    }
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
