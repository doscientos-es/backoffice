import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildQrUrl,
  createVerifactuClient,
  insert,
  registerInvoice,
  verifactuDiagnosticConfigFromEnv,
  settingsMaybeSingle,
} = vi.hoisted(() => ({
  buildQrUrl: vi.fn(),
  createVerifactuClient: vi.fn(),
  insert: vi.fn(),
  registerInvoice: vi.fn(),
  verifactuDiagnosticConfigFromEnv: vi.fn(),
  settingsMaybeSingle: vi.fn(),
}));

vi.mock("@doscientos/verifactu", () => ({
  createVerifactuClient,
}));
vi.mock("./config", () => ({
  verifactuDiagnosticConfigFromEnv,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "settings"
        ? { select: () => ({ eq: () => ({ maybeSingle: settingsMaybeSingle }) }) }
        : { insert },
  }),
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
    settingsMaybeSingle.mockReset();
    settingsMaybeSingle.mockResolvedValue({
      data: { company_nif: "B12345670", company_name: "Issuer Test S.L." },
      error: null,
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

  it("uses AEAT pre-production with a synthetic F1 recipient and stores only a passing health result", async () => {
    const result = await runVerifactuAeatTestDiagnostic("member-1");

    expect(result.ok).toBe(true);
    expect(createVerifactuClient).toHaveBeenCalledWith(
      expect.objectContaining({ environment: "test" }),
    );
    expect(registerInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        nif: "B12345670",
        emisorName: "Issuer Test S.L.",
        clientNif: "00000000T",
        clientName: "DESTINATARIO DE PRUEBAS VERI*FACTU",
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

  it("uses the company fiscal profile rather than diagnostic environment variables", async () => {
    await runVerifactuAeatTestDiagnostic("member-1");

    expect(registerInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ nif: "B12345670", emisorName: "Issuer Test S.L." }),
    );
  });

  it("reports missing company fiscal data without submitting to AEAT", async () => {
    settingsMaybeSingle.mockResolvedValue({
      data: { company_nif: null, company_name: "Issuer Test S.L." },
      error: null,
    });

    const result = await runVerifactuAeatTestDiagnostic("member-1");

    expect(result).toEqual({
      ok: false,
      detail:
        "La suite VERI*FACTU falló: Los datos fiscales de la empresa (NIF y razón social) son obligatorios para ejecutar el diagnóstico VERI*FACTU. La facturación real permanece bloqueada.",
    });
    expect(registerInvoice).not.toHaveBeenCalled();
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
