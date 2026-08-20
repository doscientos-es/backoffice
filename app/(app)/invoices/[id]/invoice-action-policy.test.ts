import { describe, expect, it } from "vitest";
import { aeatDeliveryLabel, getInvoiceActionPolicy } from "./invoice-action-policy";

const invoice = {
  id: "invoice-1",
  status: "draft",
  verifactu_status: "pending",
  verifactu_error: null,
  total: 100,
  amountPaid: 0,
};

describe("getInvoiceActionPolicy", () => {
  it("only exposes draft-safe actions before issuance", () => {
    expect(getInvoiceActionPolicy(invoice)).toMatchObject({
      canEdit: true,
      canIssue: true,
      canRecordPayment: false,
      canRectify: false,
    });
  });

  it("protects AEAT-accepted invoices from deletion and enables rectification", () => {
    expect(
      getInvoiceActionPolicy({ ...invoice, status: "paid", verifactu_status: "accepted" }),
    ).toMatchObject({ canDelete: false, canRectify: true, canRevertPayment: true });
  });

  it("uses retry labels only when fiscal delivery needs attention", () => {
    expect(aeatDeliveryLabel("pending")).toBe("Enviar a AEAT");
    expect(aeatDeliveryLabel("error")).toBe("Reintentar envío");
    expect(aeatDeliveryLabel("rejected")).toBe("Reintentar AEAT");
  });
});
