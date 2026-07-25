import { afterEach, describe, expect, it, vi } from "vitest";

const previousDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;

describe("public environment parsing", () => {
  afterEach(() => {
    if (previousDemoMode === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = previousDemoMode;
    vi.resetModules();
  });

  it("accepts boolean flags from CRLF .env files", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true\r\n";

    const { publicEnv } = await import("@/lib/env");

    expect(publicEnv.NEXT_PUBLIC_DEMO_MODE).toBe("true");
  });
});