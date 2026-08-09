import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
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

describe("deliverInvoiceVerifactu", () => {
  it("explains how to resolve a historical invoice without a durable record", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(deliverInvoiceVerifactu("invoice-1", "worker-1")).rejects.toThrow(
      MISSING_DURABLE_FISCAL_RECORD_MESSAGE,
    );
  });
});
