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
  normalizeAltaRechazoPrevio,
  REJECTED_RECORD_REQUIRES_REGULARIZATION_MESSAGE,
  resolveVerifactuSoftwareSnapshot,
  TERMINAL_RECORD_REQUIRES_REGULARIZATION_MESSAGE,
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

describe("resolveVerifactuSoftwareSnapshot", () => {
  const fallback = {
    producerName: "Doscientos",
    producerNif: "B12345678",
    name: "Backoffice",
    id: "D1",
    version: "1.0.0",
    installationNumber: "00000001",
    onlyVerifactu: true,
    multipleTaxpayers: false,
  };

  it("uses the bound SIF only for durable payloads created before snapshots existed", () => {
    expect(resolveVerifactuSoftwareSnapshot({ invoiceNumber: "2026-000008" }, fallback)).toBe(
      fallback,
    );
  });

  it("fails closed when a stored software snapshot is malformed", () => {
    expect(() => resolveVerifactuSoftwareSnapshot({ software: {} }, fallback)).toThrow(
      "Payload fiscal inválido: producerName",
    );
  });
});

describe("normalizeAltaRechazoPrevio", () => {
  it("omits the normal marker and preserves recovery markers", () => {
    expect(normalizeAltaRechazoPrevio("N")).toBeUndefined();
    expect(normalizeAltaRechazoPrevio("S")).toBe("S");
    expect(normalizeAltaRechazoPrevio("X")).toBe("X");
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

  it("does not misreport a definitive AEAT rejection as a blocked predecessor", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: "ledger-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "outbox-1", state: "rejected" }, error: null });

    await expect(deliverInvoiceVerifactu("invoice-1", "worker-1")).resolves.toMatchObject({
      processed: false,
      status: "rejected",
      error: REJECTED_RECORD_REQUIRES_REGULARIZATION_MESSAGE,
    });
  });

  it("explains that a terminal error requires regularization", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: "ledger-1" }, error: null })
      .mockResolvedValueOnce({
        data: { id: "outbox-1", state: "terminal_error", last_error: "Configuración inválida" },
        error: null,
      });

    await expect(deliverInvoiceVerifactu("invoice-1", "worker-1")).resolves.toMatchObject({
      processed: false,
      status: "error",
      error: expect.stringContaining(TERMINAL_RECORD_REQUIRES_REGULARIZATION_MESSAGE),
    });
  });
});
