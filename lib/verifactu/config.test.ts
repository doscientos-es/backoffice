import { beforeEach, describe, expect, it, vi } from "vitest";

const { isDemoMode, serverEnv } = vi.hoisted(() => ({
  isDemoMode: vi.fn(),
  serverEnv: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({ isDemoMode }));
vi.mock("@/lib/env", () => ({ serverEnv }));

import { verifactuDiagnosticConfigFromEnv, verifactuInvoiceConfigFromEnv } from "./config";

const operationalEnv = {
  NEXT_PUBLIC_APP_URL: "https://backoffice.example.test",
  VERIFACTU_PRODUCER_NIF: "B12345678",
  VERIFACTU_CERT_P12_BASE64: "certificate",
  VERIFACTU_CERT_PASSWORD: "password",
  VERIFACTU_CERT_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
  VERIFACTU_PRODUCER_NAME: "Doscientos",
  VERIFACTU_SOFTWARE_NAME: "Backoffice",
  VERIFACTU_SOFTWARE_ID: "D1",
  VERIFACTU_SOFTWARE_VERSION: "1.0.0",
  VERIFACTU_INSTALLATION_NUMBER: "00000001",
};

describe("VERI*FACTU environment selection", () => {
  beforeEach(() => {
    isDemoMode.mockReset();
    isDemoMode.mockReturnValue(false);
    serverEnv.mockReset();
    serverEnv.mockReturnValue(operationalEnv);
  });

  it("uses AEAT production for operational invoices and AEAT test for diagnostics", () => {
    expect(verifactuInvoiceConfigFromEnv().environment).toBe("prod");
    expect(verifactuDiagnosticConfigFromEnv().environment).toBe("test");
  });

  it("uses mock mode only for demo", () => {
    isDemoMode.mockReturnValue(true);
    serverEnv.mockReturnValue({ ...operationalEnv, VERIFACTU_PRODUCER_NIF: "" });

    expect(verifactuInvoiceConfigFromEnv().environment).toBe("mock");
    expect(verifactuDiagnosticConfigFromEnv().environment).toBe("mock");
  });
});
