import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildQrUrl, insert, registerInvoice, verifactuConfigFromEnv } = vi.hoisted(() => ({
  buildQrUrl: vi.fn(),
  insert: vi.fn(),
  registerInvoice: vi.fn(),
  verifactuConfigFromEnv: vi.fn(),
}));

vi.mock("@doscientos/verifactu", () => ({
  createVerifactuClient: vi.fn(() => ({ buildQrUrl, registerInvoice })),
}));
vi.mock("./config", () => ({
  verifactuConfigFromEnv,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

import { runVerifactuMockDiagnostic } from "./diagnostics";

describe("runVerifactuMockDiagnostic", () => {
  beforeEach(() => {
    verifactuConfigFromEnv.mockReset();
    verifactuConfigFromEnv.mockReturnValue({
      environment: "prod",
      certificate: { p12Base64: "not-used-by-mock", password: "not-used-by-mock" },
      software: {},
      appUrl: "https://backoffice.example.test",
    });
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

  it("reports a safe, actionable SIF configuration failure", async () => {
    verifactuConfigFromEnv.mockImplementation(() => {
      throw new Error("El certificado P12 de VERI*FACTU es obligatorio en producción");
    });

    const result = await runVerifactuMockDiagnostic("member-1");

    expect(result).toEqual({
      ok: false,
      detail:
        "La suite VERI*FACTU falló: El certificado P12 de VERI*FACTU es obligatorio en producción. La facturación real permanece bloqueada.",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        checks: [
          {
            key: "sif_config",
            ok: false,
            detail: "El certificado P12 de VERI*FACTU es obligatorio en producción",
          },
        ],
      }),
    );
  });
});
