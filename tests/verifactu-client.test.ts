import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-aaaaaaaaaaaaaaaaaaa",
    VERIFACTU_ENV: "mock",
    VERIFACTU_NIF_EMISOR: "B12345678",
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
  };

  it("buildVerifactuXml includes core fiscal fields and primer registro marker", async () => {
    const { buildVerifactuXml } = await import("@/lib/verifactu/client");
    const xml = buildVerifactuXml(baseInput, "deadbeef");
    expect(xml).toContain("<sum:NIF>B12345678</sum:NIF>");
    expect(xml).toContain("<sum:NumSerieFactura>A-000001</sum:NumSerieFactura>");
    expect(xml).toContain("<sum:FechaExpedicionFactura>2026-03-15</sum:FechaExpedicionFactura>");
    expect(xml).toContain("<sum:TipoFactura>F1</sum:TipoFactura>");
    expect(xml).toContain("<sum:CuotaTotal>21.00</sum:CuotaTotal>");
    expect(xml).toContain("<sum:ImporteTotal>121.00</sum:ImporteTotal>");
    expect(xml).toContain("<sum:PrimerRegistro>S</sum:PrimerRegistro>");
    expect(xml).toContain("<sum:Huella>deadbeef</sum:Huella>");
  });

  it("buildVerifactuXml chains via RegistroAnterior when previousHash is set", async () => {
    const { buildVerifactuXml } = await import("@/lib/verifactu/client");
    const xml = buildVerifactuXml({ ...baseInput, previousHash: "abc123" }, "newhash");
    expect(xml).toContain("<sum:RegistroAnterior><sum:Huella>abc123</sum:Huella></sum:RegistroAnterior>");
    expect(xml).not.toContain("PrimerRegistro");
  });

  it("submitToVerifactu in mock mode returns accepted with deterministic CSV", async () => {
    const { submitToVerifactu } = await import("@/lib/verifactu/client");
    const result = await submitToVerifactu(baseInput);
    expect(result.status).toBe("accepted");
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.csv).toBe(result.hash.slice(0, 16).toUpperCase());
    expect(result.idfact).toBe("B12345678-A-000001-20260315");
    expect(result.errorMessage).toBeNull();
    expect(result.response).toMatchObject({ mock: true });
  });

  it("submitToVerifactu returns 'error' (not implemented) for test/prod modes", async () => {
    process.env.VERIFACTU_ENV = "test";
    vi.resetModules();
    const { submitToVerifactu } = await import("@/lib/verifactu/client");
    const result = await submitToVerifactu(baseInput);
    expect(result.status).toBe("error");
    expect(result.csv).toBeNull();
    expect(result.errorMessage).toMatch(/no implementado/i);
  });

  it("computes the same hash twice for the same payload (determinism)", async () => {
    const { submitToVerifactu } = await import("@/lib/verifactu/client");
    const a = await submitToVerifactu(baseInput);
    const b = await submitToVerifactu(baseInput);
    expect(a.hash).toBe(b.hash);
  });
});
