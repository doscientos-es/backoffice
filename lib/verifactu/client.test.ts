import type { SistemaInformaticoEnv } from "@/lib/verifactu/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const mockSistemaEnv: SistemaInformaticoEnv = {
  VERIFACTU_SOFTWARE_NAME: "TestApp",
  VERIFACTU_SOFTWARE_ID: "TEST01",
  VERIFACTU_SOFTWARE_VERSION: "1.0.0",
  VERIFACTU_INSTALLATION_NUMBER: "00000001",
};

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-aaaaaaaaaaaaaaaaaaa",
    VERIFACTU_ENV: "mock",
    VERIFACTU_NIF_EMISOR: "B12345678",
    VERIFACTU_SOFTWARE_NAME: "TestApp",
    VERIFACTU_SOFTWARE_ID: "TEST01",
    VERIFACTU_SOFTWARE_VERSION: "1.0.0",
    VERIFACTU_INSTALLATION_NUMBER: "00000001",
    LOG_LEVEL: "error",
  };
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("verifactu/client", () => {
  const baseInput = {
    nif: "B12345678",
    invoiceNumber: "A-000001",
    invoiceType: "F1",
    issueDate: new Date("2026-03-15T00:00:00.000Z"),
    taxAmount: 21,
    total: 121,
    previousHash: null,
    generatedAt: new Date("2026-03-15T12:00:00.000Z"),
    emisorName: "Test Company S.L.",
    clientNif: "12345678A",
    clientName: "Test Client",
    descriptionOperacion: "Servicios de prueba",
    vatLines: [{ rate: 21, base: 100, tax: 21 }],
    previousInvoiceNumber: null,
    previousIssueDate: null,
  };

  it("buildVerifactuXml includes all mandatory fiscal fields", async () => {
    const { buildVerifactuXml } = await import("@/lib/verifactu/client");
    const xml = buildVerifactuXml(baseInput, "deadbeef", mockSistemaEnv);
    expect(xml).toContain("<sum:IDVersion>1.0</sum:IDVersion>");
    expect(xml).toContain("<sum:NIF>B12345678</sum:NIF>");
    expect(xml).toContain("<sum:NombreRazonEmisor>Test Company S.L.</sum:NombreRazonEmisor>");
    expect(xml).toContain("<sum:NumSerieFactura>A-000001</sum:NumSerieFactura>");
    expect(xml).toContain("<sum:FechaExpedicionFactura>15-03-2026</sum:FechaExpedicionFactura>");
    expect(xml).toContain("<sum:TipoFactura>F1</sum:TipoFactura>");
    expect(xml).toContain(
      "<sum:DescripcionOperacion>Servicios de prueba</sum:DescripcionOperacion>",
    );
    expect(xml).toContain("<sum:NIF>12345678A</sum:NIF>"); // Destinatarios
    expect(xml).toContain("<sum:TipoImpositivo>21.00</sum:TipoImpositivo>");
    expect(xml).toContain("<sum:CuotaTotal>21.00</sum:CuotaTotal>");
    expect(xml).toContain("<sum:ImporteTotal>121.00</sum:ImporteTotal>");
    expect(xml).toContain("<sum:PrimerRegistro>S</sum:PrimerRegistro>");
    expect(xml).toContain("<sum:TipoHuella>01</sum:TipoHuella>");
    expect(xml).toContain("<sum:Huella>deadbeef</sum:Huella>");
    expect(xml).toContain("<sum:IdSistemaInformatico>TEST01</sum:IdSistemaInformatico>");
  });

  it("buildVerifactuXml chains via RegistroAnterior when previousHash + prev invoice ID are set", async () => {
    const { buildVerifactuXml } = await import("@/lib/verifactu/client");
    const xml = buildVerifactuXml(
      {
        ...baseInput,
        previousHash: "abc123",
        previousInvoiceNumber: "A-000001",
        previousIssueDate: new Date("2026-01-15T00:00:00.000Z"),
      },
      "newhash",
      mockSistemaEnv,
    );
    expect(xml).toContain("<sum:RegistroAnterior>");
    expect(xml).toContain("<sum:NumSerieFacturaAnterior>A-000001</sum:NumSerieFacturaAnterior>");
    expect(xml).toContain("<sum:Huella>abc123</sum:Huella>");
    expect(xml).not.toContain("PrimerRegistro");
  });

  it("buildVerifactuXml falls back to PrimerRegistro when previousInvoiceNumber is missing", async () => {
    const { buildVerifactuXml } = await import("@/lib/verifactu/client");
    // previousHash set but previousInvoiceNumber not → treated as first invoice
    const xml = buildVerifactuXml(
      { ...baseInput, previousHash: "abc123" },
      "newhash",
      mockSistemaEnv,
    );
    expect(xml).toContain("<sum:PrimerRegistro>S</sum:PrimerRegistro>");
  });

  it("submitToVerifactu in mock mode returns accepted with deterministic CSV", async () => {
    const { submitToVerifactu } = await import("@/lib/verifactu/client");
    const result = await submitToVerifactu(baseInput);
    expect(result.status).toBe("accepted");
    expect(result.hash).toMatch(/^[A-F0-9]{64}$/);
    expect(result.csv).toBe(result.hash.slice(0, 16).toUpperCase());
    expect(result.idfact).toBe("B12345678-A-000001-20260315");
    expect(result.errorMessage).toBeNull();
    expect(result.response).toMatchObject({ mock: true });
  });

  it("submitToVerifactu returns error when cert is missing in test mode", async () => {
    process.env.VERIFACTU_ENV = "test";
    vi.resetModules();
    const { submitToVerifactu } = await import("@/lib/verifactu/client");
    const result = await submitToVerifactu(baseInput);
    expect(result.status).toBe("error");
    expect(result.csv).toBeNull();
    expect(result.errorMessage).toMatch(/certificado|certificate/i);
  });

  it("computes the same hash twice for the same payload (determinism)", async () => {
    const { submitToVerifactu } = await import("@/lib/verifactu/client");
    const a = await submitToVerifactu(baseInput);
    const b = await submitToVerifactu(baseInput);
    expect(a.hash).toBe(b.hash);
  });
});
