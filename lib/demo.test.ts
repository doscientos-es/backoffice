import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: { demo: "false" as "true" | "false", publicDemo: "false" as "true" | "false" },
}));

vi.mock("@/lib/env", () => ({
  serverEnv: () => ({ DEMO_MODE: state.demo, NEXT_PUBLIC_DEMO_MODE: state.publicDemo }),
}));

import { assertExternalActionAllowed, isDemoMode, isPublicDemoMode } from "./demo";

describe("demo mode", () => {
  beforeEach(() => {
    state.demo = "false";
    state.publicDemo = "false";
  });

  it("is disabled by default", () => {
    expect(isDemoMode()).toBe(false);
    expect(isPublicDemoMode()).toBe(false);
  });

  it("uses the server flag as the source of truth", () => {
    state.demo = "true";
    expect(isDemoMode()).toBe(true);
    expect(isPublicDemoMode()).toBe(true);
  });

  it("fails closed for integrations in demo mode", () => {
    state.demo = "true";
    expect(() => assertExternalActionAllowed("Telegram")).toThrow(
      "Telegram está desactivado en modo demo",
    );
  });
});
