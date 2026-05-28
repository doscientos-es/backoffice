import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    callOrder: [] as string[],
    signOutOpts: undefined as { scope?: string } | undefined,
    exchangedCode: null as string | null,
    exchangeError: null as { message: string } | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: {
      signOut: async (opts?: { scope?: string }) => {
        state.callOrder.push("signOut");
        state.signOutOpts = opts;
        return { error: null };
      },
      exchangeCodeForSession: async (code: string) => {
        state.callOrder.push("exchange");
        state.exchangedCode = code;
        return state.exchangeError
          ? { data: null, error: state.exchangeError }
          : { data: {}, error: null };
      },
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from "@/app/auth/callback/route";
import { NextRequest } from "next/server";

function call(path: string) {
  return GET(new NextRequest(`http://localhost${path}`));
}

describe("/auth/callback", () => {
  beforeEach(() => {
    state.callOrder = [];
    state.signOutOpts = undefined;
    state.exchangedCode = null;
    state.exchangeError = null;
  });

  it("signs out before exchanging the code", async () => {
    await call("/auth/callback?code=abc&next=/inicio");
    expect(state.callOrder).toEqual(["signOut", "exchange"]);
    expect(state.signOutOpts).toEqual({ scope: "local" });
    expect(state.exchangedCode).toBe("abc");
  });

  it("redirects to the validated next path on success", async () => {
    const res = await call("/auth/callback?code=abc&next=/login/update-password");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login/update-password");
  });

  it("defaults next to /inicio when missing", async () => {
    const res = await call("/auth/callback?code=abc");
    expect(res.headers.get("location")).toBe("http://localhost/inicio");
  });

  it("rejects external next values and falls back to /inicio", async () => {
    const res = await call("/auth/callback?code=abc&next=https://evil.com/steal");
    expect(res.headers.get("location")).toBe("http://localhost/inicio");
  });

  it("redirects to /login with error when code is missing", async () => {
    const res = await call("/auth/callback");
    expect(res.headers.get("location")).toBe("http://localhost/login?error=callback_no_code");
    expect(state.callOrder).toEqual([]);
  });

  it("surfaces provider error params without calling the exchange", async () => {
    const res = await call(
      "/auth/callback?error=access_denied&error_description=link%20expired",
    );
    expect(res.headers.get("location")).toContain("/login?error=callback_link%20expired");
    expect(state.callOrder).toEqual([]);
  });

  it("redirects to /login when exchangeCodeForSession fails", async () => {
    state.exchangeError = { message: "invalid pkce verifier" };
    const res = await call("/auth/callback?code=bad");
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=callback_exchange_failed",
    );
    // signOut still ran first — that's the security invariant we care about.
    expect(state.callOrder).toEqual(["signOut", "exchange"]);
  });
});
