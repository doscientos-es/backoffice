import type { BuildInvoicePdfInput } from "@/lib/invoices/pdf-data";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_NIF = process.env.VERIFACTU_NIF_EMISOR;

function makeInput(overrides: Partial<BuildInvoicePdfInput["invoice"]> = {}): BuildInvoicePdfInput {
  return {
    invoice: {
      full_number: "FAC-2025-001",
      invoice_type: "ordinaria",
      status: "issued",
      issue_date: "2025-01-05",
      due_date: "2025-02-05",
      idfact: "IDFACT-1",
      verifactu_csv: "CSV-1",
      subtotal: 1000,
      total: 1210,
      client_nif: "12345678Z",
      ...overrides,
    },
    clientName: "Acme S.L.",
    items: [
      { description: "Servicio", quantity: 2, unit_price: 500, vat_rate: 21, subtotal: 1000 },
      { description: null, quantity: null, unit_price: null, vat_rate: null, subtotal: null },
    ],
    settings: {
      company_name: "Doscientos",
      company_nif: "B00000000",
      company_address: "C/ Falsa 1, 08001 Barcelona, Barcelona, ES",
      iban: "ES000",
    },
  };
}

async function importPdfData(nif: string) {
  vi.resetModules();
  process.env.VERIFACTU_NIF_EMISOR = nif;
  process.env.VERIFACTU_ENV = "mock";
  return import("@/lib/invoices/pdf-data");
}

afterEach(() => {
  process.env.VERIFACTU_NIF_EMISOR = ORIGINAL_NIF;
  vi.resetModules();
});

describe("buildInvoicePdfData", () => {
  it("normalises items, coercing null fields to safe numbers", async () => {
    const { buildInvoicePdfData } = await importPdfData("");
    const data = await buildInvoicePdfData(makeInput());
    expect(data.items).toHaveLength(2);
    expect(data.items[1]).toEqual({
      description: "",
      quantity: 0,
      unitPrice: 0,
      vatRate: 0,
      subtotal: 0,
    });
    expect(data.fullNumber).toBe("FAC-2025-001");
    expect(data.clientName).toBe("Acme S.L.");
    expect(data.company?.name).toBe("Doscientos");
    expect(data.vatBreakdown.length).toBeGreaterThan(0);
  });

  it("returns null company when settings are absent", async () => {
    const { buildInvoicePdfData } = await importPdfData("");
    const input = { ...makeInput(), settings: null };
    const data = await buildInvoicePdfData(input);
    expect(data.company).toBeNull();
  });

  it("omits the QR when the emisor NIF is not configured", async () => {
    const { buildInvoicePdfData } = await importPdfData("");
    const data = await buildInvoicePdfData(makeInput());
    expect(data.qrDataUrl).toBeNull();
  });

  it("omits the QR for draft invoices even with a NIF", async () => {
    const { buildInvoicePdfData } = await importPdfData("B11111111");
    const data = await buildInvoicePdfData(makeInput({ status: "draft" }));
    expect(data.qrDataUrl).toBeNull();
  });

  it("builds a QR data URL for a complete, issued invoice", async () => {
    const { buildInvoicePdfData } = await importPdfData("B11111111");
    const data = await buildInvoicePdfData(makeInput());
    expect(data.qrDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe("invoicePdfFilename", () => {
  it("uses the full number when present", async () => {
    const { invoicePdfFilename } = await importPdfData("");
    expect(invoicePdfFilename("FAC 2025/001", "abc")).toBe("factura-FAC-2025-001.pdf");
  });
  it("falls back to the id when the number is null or sanitises to empty", async () => {
    const { invoicePdfFilename } = await importPdfData("");
    expect(invoicePdfFilename(null, "abc")).toBe("factura-abc.pdf");
    expect(invoicePdfFilename("///", "abc")).toBe("factura-abc.pdf");
  });
});
