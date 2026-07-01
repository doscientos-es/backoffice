import { buildVerifactuXml, submitToVerifactu } from "@/lib/verifactu/client";
import type { VerifactuConfig, VerifactuSoftware } from "@/lib/verifactu/config";
import { describe, expect, it } from "vitest";

const mockSoftware: VerifactuSoftware = {
  name: "TestApp",
  id: "TEST01",
  version: "1.0.0",
  installationNumber: "00000001",
};

const mockConfig: VerifactuConfig = {
  environment: "mock",
  certificate: { p12Base64: "", password: "" },
  software: mockSoftware,
  appUrl: "https://app.test",
};

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

  it("buildVerifactuXml includes all mandatory fiscal fields", () => {
    const xml = buildVerifactuXml(baseInput, "deadbeef", mockSoftware);
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

  it("buildVerifactuXml chains via RegistroAnterior when previousHash + prev invoice ID are set", () => {
    const xml = buildVerifactuXml(
      {
        ...baseInput,
        previousHash: "abc123",
        previousInvoiceNumber: "A-000001",
        previousIssueDate: new Date("2026-01-15T00:00:00.000Z"),
      },
      "newhash",
      mockSoftware,
    );
    expect(xml).toContain("<sum:RegistroAnterior>");
    expect(xml).toContain("<sum:NumSerieFacturaAnterior>A-000001</sum:NumSerieFacturaAnterior>");
    expect(xml).toContain("<sum:Huella>abc123</sum:Huella>");
    expect(xml).not.toContain("PrimerRegistro");
  });

  it("buildVerifactuXml falls back to PrimerRegistro when previousInvoiceNumber is missing", () => {
    // previousHash set but previousInvoiceNumber not → treated as first invoice
    const xml = buildVerifactuXml(
      { ...baseInput, previousHash: "abc123" },
      "newhash",
      mockSoftware,
    );
    expect(xml).toContain("<sum:PrimerRegistro>S</sum:PrimerRegistro>");
  });

  it("submitToVerifactu in mock mode returns accepted with deterministic CSV", async () => {
    const result = await submitToVerifactu(baseInput, mockConfig);
    expect(result.status).toBe("accepted");
    expect(result.hash).toMatch(/^[A-F0-9]{64}$/);
    expect(result.csv).toBe(result.hash.slice(0, 16).toUpperCase());
    expect(result.idfact).toBe("B12345678-A-000001-20260315");
    expect(result.errorMessage).toBeNull();
    expect(result.response).toMatchObject({ mock: true });
  });

  it("submitToVerifactu returns error when cert is missing in test mode", async () => {
    const result = await submitToVerifactu(baseInput, { ...mockConfig, environment: "test" });
    expect(result.status).toBe("error");
    expect(result.csv).toBeNull();
    expect(result.errorMessage).toMatch(/certificado|certificate/i);
  });

  it("computes the same hash twice for the same payload (determinism)", async () => {
    const a = await submitToVerifactu(baseInput, mockConfig);
    const b = await submitToVerifactu(baseInput, mockConfig);
    expect(a.hash).toBe(b.hash);
  });
});
