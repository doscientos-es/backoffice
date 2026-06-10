import { describe, expect, it } from "vitest";
import {
  CreateInvoiceFromProposalInput,
  InvoiceIdInput,
  InvoiceStatus,
  SendInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
} from "@/lib/schemas/invoice";

const uuid = "11111111-1111-1111-1111-111111111111";

describe("InvoiceStatus", () => {
  it("validates members", () => {
    expect(InvoiceStatus.parse("paid")).toBe("paid");
    expect(InvoiceStatus.safeParse("nope").success).toBe(false);
  });
});

describe("id payloads", () => {
  it("validate uuid shapes", () => {
    expect(InvoiceIdInput.safeParse({ id: uuid }).success).toBe(true);
    expect(SendInvoiceInput.safeParse({ id: "x" }).success).toBe(false);
    expect(
      CreateInvoiceFromProposalInput.safeParse({ proposalId: uuid }).success,
    ).toBe(true);
  });
});

describe("UpdateInvoiceInput", () => {
  it("requires at least one line item when items provided", () => {
    expect(UpdateInvoiceInput.safeParse({ id: uuid, items: [] }).success).toBe(false);
  });
  it("coerces line items and defaults", () => {
    const out = UpdateInvoiceInput.parse({
      id: uuid,
      items: [{ description: "Servicio", quantity: "2", unit_price: "50" }],
    });
    expect(out.items?.[0]?.quantity).toBe(2);
    expect(out.items?.[0]?.vat_rate).toBe(21);
    expect(out.items?.[0]?.billing_cycle).toBe("none");
  });
  it("accepts a payload with only an id", () => {
    expect(UpdateInvoiceInput.safeParse({ id: uuid }).success).toBe(true);
  });
});

describe("UpdateInvoiceStatusInput", () => {
  it("validates id + status", () => {
    expect(UpdateInvoiceStatusInput.safeParse({ id: uuid, status: "issued" }).success).toBe(true);
    expect(UpdateInvoiceStatusInput.safeParse({ id: uuid, status: "nope" }).success).toBe(false);
  });
});
