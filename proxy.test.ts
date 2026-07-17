/**
 * proxy.test.ts – Middleware / route-protection E2E
 *
 * Strategy: call `proxy()` directly with a crafted NextRequest and assert on
 * the returned NextResponse (status, Location header). Supabase auth is mocked
 * to control the "user present / absent" axis without a real network call.
 *
 * What we cover:
 *  - Unauthenticated requests → redirect to /login?next=<path>
 *  - Authenticated requests   → NextResponse.next() (200)
 *  - Public paths             → always pass through
 *  - /p/ portal paths         → pass through (rate-limited per IP)
 *  - /p/ portal paths         → 429 when the bucket is exhausted
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── shared mutable state controlled per-test ──────────────────────────────────

const { auth, rateLimitResult } = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null },
  rateLimitResult: { success: true, resetAt: Date.now() + 60_000 },
}));

// Mock Supabase SSR: we only need `auth.getUser()`
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: auth.user }, error: null }),
    },
  }),
}));

// Mock the rate-limiter so we can simulate exhaustion without real timers
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: () => rateLimitResult,
}));

// Import AFTER mocks are registered
import { proxy } from "@/proxy";

// ── helpers ───────────────────────────────────────────────────────────────────

function req(path: string, ip = "1.2.3.4") {
  const headers = new Headers();
  headers.set("x-forwarded-for", ip);
  return new NextRequest(`http://localhost${path}`, {
    headers,
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("proxy – unauthenticated requests", () => {
  beforeEach(() => {
    auth.user = null;
    rateLimitResult.success = true;
  });

  it("redirects to /login preserving the original path as ?next", async () => {
    const res = await proxy(req("/inicio"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login?next=%2Finicio");
  });

  it("redirects nested paths correctly", async () => {
    const res = await proxy(req("/leads/abc-123"));
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/login");
    expect(loc).toContain("next=%2Fleads%2Fabc-123");
  });
});

describe("proxy – authenticated requests", () => {
  beforeEach(() => {
    auth.user = { id: "user-1" };
    rateLimitResult.success = true;
  });

  it("passes through protected routes when authenticated", async () => {
    const res = await proxy(req("/inicio"));
    // NextResponse.next() has no redirect location
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through deep routes when authenticated", async () => {
    const res = await proxy(req("/clients/some-uuid/details"));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy – public paths (always pass through)", () => {
  beforeEach(() => {
    auth.user = null; // Even unauthenticated must pass
    rateLimitResult.success = true;
  });

  it.each([
    ["/login"],
    ["/login/forgot-password"],
    ["/auth/callback"],
    ["/auth/confirm"],
    ["/auth/confirm?token_hash=abc&type=invite&next=/onboarding"],
    ["/api/webhooks/stripe"],
    ["/api/email/webhook"],
    ["/api/public/status"],
    ["/api/cron/web-backups"],
  ])("passes through %s without auth check", async (path) => {
    const res = await proxy(req(path));
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy – /p/ portal routes (rate-limited, no auth)", () => {
  beforeEach(() => {
    auth.user = null;
    rateLimitResult.success = true;
    rateLimitResult.resetAt = Date.now() + 60_000;
  });

  it("passes through /p/ paths when under the limit", async () => {
    const res = await proxy(req("/p/invoice/some-token"));
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(429);
  });

  it("returns 429 when the rate bucket is exhausted", async () => {
    rateLimitResult.success = false;
    const res = await proxy(req("/p/invoice/some-token"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });
});

describe("proxy – static / Next.js internals (always pass through)", () => {
  it("passes through /_next/ paths", async () => {
    auth.user = null;
    const res = await proxy(req("/_next/static/chunk.js"));
    expect(res.status).not.toBe(307);
  });

  it("passes through /favicon paths", async () => {
    auth.user = null;
    const res = await proxy(req("/favicon.ico"));
    expect(res.status).not.toBe(307);
  });
});
