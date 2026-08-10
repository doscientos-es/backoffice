import { describe, expect, it, vi } from "vitest";

const { serverEnv } = vi.hoisted(() => ({
  serverEnv: vi.fn(() => ({
    VAULT_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString("base64"),
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-aaaaaaaaaaaaaaaa",
  })),
}));

vi.mock("@/lib/env", () => ({ serverEnv }));

import { decryptSecret, encryptSecret } from "./crypto";

describe("vault crypto", () => {
  it("uses the validated environment key to round-trip a secret", () => {
    const ciphertext = encryptSecret("vault secret");

    expect(ciphertext).not.toContain("vault secret");
    expect(decryptSecret(ciphertext)).toBe("vault secret");
    expect(serverEnv).toHaveBeenCalled();
  });
});
