import { describe, expect, it } from "vitest";
import { printableMarkdown, proposalPdfFilename, renderProposalPdf } from "./proposal-pdf-document";

describe("proposal PDF helpers", () => {
  it("creates a safe download filename from the proposal number", () => {
    expect(proposalPdfFilename("P/2026 001", "fallback-id")).toBe("propuesta-P-2026-001.pdf");
    expect(proposalPdfFilename(null, "fallback-id")).toBe("propuesta-fallback-id.pdf");
  });

  it("turns the markdown content into PDF-friendly text", () => {
    expect(printableMarkdown("## **Alcance**\n\n[Ver detalle](https://example.test)")).toBe(
      "Alcance Ver detalle",
    );
  });

  it("renders a valid PDF document", async () => {
    const pdf = await renderProposalPdf({
      number: "P-001",
      title: "Automatización comercial",
      recipientName: "Acme SL",
      validUntil: null,
      context: null,
      problems: [],
      solutions: [],
      terms: null,
      notes: null,
      subtotal: 1000,
      taxAmount: 210,
      total: 1210,
      items: [
        {
          id: "item-1",
          description: "Implementación",
          quantity: 1,
          unitPrice: 1000,
          vatRate: 21,
          subtotal: 1000,
          billingCycle: "none",
        },
      ],
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
