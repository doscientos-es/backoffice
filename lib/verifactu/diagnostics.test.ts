import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildQrUrl,
  createVerifactuClient,
  insert,
  registerInvoice,
  verifactuDiagnosticConfigFromEnv,
  verifactuDiagnosticIssuerFromEnv,
} = vi.hoisted(() => ({
  buildQrUrl: vi.fn(),
  createVerifactuClient: vi.fn(),
  insert: vi.fn(),
  registerInvoice: vi.fn(),
  verifactuDiagnosticConfigFromEnv: vi.fn(),
  verifactuDiagnosticIssuerFromEnv: vi.fn(),
}));

vi.mock("@doscientos/verifactu", () => ({
  createVerifactuClient,
}));
vi.mock("./config", () => ({
  verifactuDiagnosticConfigFromEnv,
  verifactuDiagnosticIssuerFromEnv,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

import { runVerifactuAeatTestDiagnostic } from "./diagnostics";

describe("runVerifactuAeatTestDiagnostic", () => {
  beforeEach(() => {
    verifactuDiagnosticConfigFromEnv.mockReset();
    verifactuDiagnosticConfigFromEnv.mockReturnValue({
      environment: "test",
      certificate: { p12Base64: "not-used-by-test", password: "not-used-by-test" },
      software: {},
      appUrl: "https://backoffice.example.test",
    });
    verifactuDiagnosticIssuerFromEnv.mockReset();
    verifactuDiagnosticIssuerFromEnv.mockReturnValue({
      nif: "B12345670",
      name: "Issuer Test S.L.",
    });
    buildQrUrl.mockReset();
    buildQrUrl.mockReturnValue("https://backoffice.example.test/api/verifactu/verify");
    createVerifactuClient.mockReset();
    createVerifactuClient.mockReturnValue({ buildQrUrl, registerInvoice });
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
    registerInvoice.mockReset();
    registerInvoice.mockResolvedValue({
      status: "accepted",
      hash: "A".repeat(64),
      response: { acceptedBy: "aeat-test" },
      errorMessage: null,
    });
  });

  it("uses AEAT pre-production and stores only a passing health result", async () => {
    const result = await runVerifactuAeatTestDiagnostic("member-1");

    expect(result.ok).toBe(true);
    expect(createVerifactuClient).toHaveBeenCalledWith(
      expect.objectContaining({ environment: "test" }),
    );
    expect(registerInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        nif: "B12345670",
        emisorName: "Issuer Test S.L.",
        clientNif: null,
        clientName: null,
      }),
    );
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

    const result = await runVerifactuAeatTestDiagnostic("member-1");

    expect(result.ok).toBe(false);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("reports a safe, actionable SIF configuration failure", async () => {
    verifactuDiagnosticConfigFromEnv.mockImplementation(() => {
      throw new Error("El certificado P12 de VERI*FACTU es obligatorio para conectar con AEAT");
    });

    const result = await runVerifactuAeatTestDiagnostic("member-1");

    expect(result).toEqual({
      ok: false,
      detail:
        "La suite VERI*FACTU falló: El certificado P12 de VERI*FACTU es obligatorio para conectar con AEAT. La facturación real permanece bloqueada.",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        checks: [
          {
            key: "sif_config",
            ok: false,
            detail: "El certificado P12 de VERI*FACTU es obligatorio para conectar con AEAT",
          },
        ],
      }),
    );
  });
});
