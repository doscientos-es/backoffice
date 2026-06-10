import {
  buildPortalAccessPatch,
  hashPortalPassword,
  verifyPortalPassword,
} from "@/lib/portal/access";
import { describe, expect, it } from "vitest";

describe("hashPortalPassword / verifyPortalPassword", () => {
  it("produces a self-describing scrypt string", () => {
    const hash = hashPortalPassword("s3cret");
    const parts = hash.split("$");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte hex salt
    expect(parts[2]).toMatch(/^[0-9a-f]{128}$/); // 64-byte derived key
  });

  it("uses a random salt so two hashes of the same password differ", () => {
    expect(hashPortalPassword("same")).not.toBe(hashPortalPassword("same"));
  });

  it("verifies a correct password", () => {
    const hash = hashPortalPassword("correct horse");
    expect(verifyPortalPassword("correct horse", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPortalPassword("correct horse");
    expect(verifyPortalPassword("wrong", hash)).toBe(false);
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPortalPassword("x", "")).toBe(false);
    expect(verifyPortalPassword("x", "notscrypt$salt$derived")).toBe(false);
    expect(verifyPortalPassword("x", "scrypt$only-two")).toBe(false);
    expect(verifyPortalPassword("x", "scrypt$$")).toBe(false);
  });

  it("rejects when the stored derived key length differs", () => {
    // valid prefix + salt but truncated derived key → length mismatch branch
    const [, salt] = hashPortalPassword("p").split("$");
    expect(verifyPortalPassword("p", `scrypt$${salt}$ab`)).toBe(false);
  });
});

describe("buildPortalAccessPatch", () => {
  it("returns an empty patch when nothing was touched", () => {
    expect(buildPortalAccessPatch({})).toEqual({});
  });

  it("maps the visibility toggle", () => {
    expect(buildPortalAccessPatch({ is_client_visible: false })).toEqual({
      is_client_visible: false,
    });
  });

  it("hashes a new password into portal_password_hash", () => {
    const patch = buildPortalAccessPatch({ password: "let-me-in" });
    expect(typeof patch.portal_password_hash).toBe("string");
    expect(verifyPortalPassword("let-me-in", patch.portal_password_hash as string)).toBe(true);
  });

  it("clears the hash when password is null or empty string", () => {
    expect(buildPortalAccessPatch({ password: null })).toEqual({
      portal_password_hash: null,
    });
    expect(buildPortalAccessPatch({ password: "" })).toEqual({
      portal_password_hash: null,
    });
  });

  it("combines visibility and password changes", () => {
    const patch = buildPortalAccessPatch({ is_client_visible: true, password: "pw" });
    expect(patch.is_client_visible).toBe(true);
    expect(verifyPortalPassword("pw", patch.portal_password_hash as string)).toBe(true);
  });
});
