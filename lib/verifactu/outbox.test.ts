import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          order: () => query,
          limit: () => query,
          maybeSingle,
        };
        return query;
      },
    }),
  }),
}));

import {
  deliverInvoiceVerifactu,
  formatOutboxError,
  isRetryableVerifactuDelivery,
  MISSING_DURABLE_FISCAL_RECORD_MESSAGE,
} from "./outbox";

beforeEach(() => {
  maybeSingle.mockReset();
});

describe("formatOutboxError", () => {
  it("preserves the AEAT code with its actionable description", () => {
    expect(
      formatOutboxError(null, {
        aeatCode: "4102",
        errorMessage: "NIF del destinatario no válido",
      }),
    ).toBe("AEAT 4102: NIF del destinatario no válido");
  });

  it("preserves a technical error without inventing an AEAT code", () => {
    expect(formatOutboxError("Certificado P12 inválido", null)).toBe("Certificado P12 inválido");
  });
});

describe("isRetryableVerifactuDelivery", () => {
  const error = (errorCode: "configuration_invalid" | "network_error" | "response_invalid") => ({
    status: "error" as const,
    csv: null,
    hash: "A".repeat(64),
    idfact: "B12345678-A-1-20260101",
    response: {},
    errorMessage: "test error",
    errorCode,
    aeatCode: null,
    aeatStatus: null,
    warnings: [],
  });

  it("retries only failures where AEAT may not have produced a durable result", () => {
    expect(isRetryableVerifactuDelivery(error("network_error"))).toBe(true);
    expect(isRetryableVerifactuDelivery(error("response_invalid"))).toBe(true);
    expect(isRetryableVerifactuDelivery(error("configuration_invalid"))).toBe(false);
  });

  it("retries only transient HTTP responses", () => {
    expect(
      isRetryableVerifactuDelivery({
        ...error("network_error"),
        errorCode: "http_error",
        response: { httpStatus: 503 },
      }),
    ).toBe(true);
    expect(
      isRetryableVerifactuDelivery({
        ...error("network_error"),
        errorCode: "http_error",
        response: { httpStatus: 400 },
      }),
    ).toBe(false);
  });
});

describe("deliverInvoiceVerifactu", () => {
  it("explains how to resolve a historical invoice without a durable record", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(deliverInvoiceVerifactu("invoice-1", "worker-1")).rejects.toThrow(
      MISSING_DURABLE_FISCAL_RECORD_MESSAGE,
    );
  });
});
