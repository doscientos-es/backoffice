import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildQrUrl, insert, registerInvoice } = vi.hoisted(() => ({
  buildQrUrl: vi.fn(),
  insert: vi.fn(),
  registerInvoice: vi.fn(),
}));

vi.mock("@doscientos/verifactu", () => ({
  createVerifactuClient: vi.fn(() => ({ buildQrUrl, registerInvoice })),
}));
vi.mock("./config", () => ({
  verifactuConfigFromEnv: () => ({
    environment: "prod",
    certificate: { p12Base64: "not-used-by-mock", password: "not-used-by-mock" },
    software: {},
    appUrl: "https://backoffice.example.test",
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

import { runVerifactuMockDiagnostic } from "./diagnostics";

describe("runVerifactuMockDiagnostic", () => {
  beforeEach(() => {
    buildQrUrl.mockReset();
    buildQrUrl.mockReturnValue("https://backoffice.example.test/api/verifactu/verify");
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
    registerInvoice.mockReset();
    registerInvoice.mockResolvedValue({
      status: "accepted",
      hash: "A".repeat(64),
      response: { mock: true },
      errorMessage: null,
    });
  });

  it("uses an in-memory mock record and stores only a passing health result", async () => {
    const result = await runVerifactuMockDiagnostic("member-1");

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: "member-1", status: "passed" }),
    );
  });

  it("persists a failed run so it invalidates a previous passing diagnostic", async () => {
    registerInvoice.mockResolvedValue({
      status: "error",
      hash: "A".repeat(64),
      response: { mock: false },
      errorMessage: "XML no conforme",
    });

    const result = await runVerifactuMockDiagnostic("member-1");

    expect(result.ok).toBe(false);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
});
