import { describe, expect, it } from "vitest";
import { VaultEncryptionKeySchema } from "./env.schema";

describe("VaultEncryptionKeySchema", () => {
  it("accepts an empty local-development fallback", () => {
    expect(VaultEncryptionKeySchema.safeParse("").success).toBe(true);
  });

  it("accepts a canonical 32-byte Base64 key", () => {
    const key = Buffer.alloc(32, 42).toString("base64");
    expect(VaultEncryptionKeySchema.safeParse(key).success).toBe(true);
  });

  it("rejects malformed or incorrectly sized keys", () => {
    expect(VaultEncryptionKeySchema.safeParse("not-base64").success).toBe(false);
    expect(VaultEncryptionKeySchema.safeParse(Buffer.alloc(31).toString("base64")).success).toBe(
      false,
    );
  });
});
