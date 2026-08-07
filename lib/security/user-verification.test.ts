import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => {
  let value: string | undefined;
  const store = {
    get: vi.fn(() => (value ? { value } : undefined)),
    set: vi.fn((_: string, next: string) => {
      value = next;
    }),
    delete: vi.fn(() => {
      value = undefined;
    }),
  };
  return { state: { store, clear: () => (value = undefined) } };
});

vi.mock("next/headers", () => ({ cookies: async () => state.store }));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: "test-key" }) }));

import { consumeUserVerification, grantUserVerification } from "./user-verification";
import { userVerificationScope } from "./user-verification-scope";

describe("user verification scopes", () => {
  beforeEach(() => {
    state.clear();
    state.store.get.mockClear();
    state.store.set.mockClear();
    state.store.delete.mockClear();
  });

  it("consumes a grant only for its exact intent and resource", async () => {
    const scope = userVerificationScope("invoice.send_aeat", "invoice:invoice-a");
    await grantUserVerification("user-a", scope);

    await expect(consumeUserVerification("user-a", scope)).resolves.toBeUndefined();
    expect(state.store.delete).toHaveBeenCalledOnce();
    await expect(consumeUserVerification("user-a", scope)).rejects.toThrow("Confirma tu identidad");
  });

  it("rejects a grant when the resource changes and consumes it on the failed attempt", async () => {
    await grantUserVerification(
      "user-a",
      userVerificationScope("invoice.send_aeat", "invoice:invoice-a"),
    );

    await expect(
      consumeUserVerification(
        "user-a",
        userVerificationScope("invoice.send_aeat", "invoice:invoice-b"),
      ),
    ).rejects.toThrow("Confirma tu identidad");
    await expect(
      consumeUserVerification(
        "user-a",
        userVerificationScope("invoice.send_aeat", "invoice:invoice-a"),
      ),
    ).rejects.toThrow("Confirma tu identidad");
  });
});
