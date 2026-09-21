import { describe, expect, it, vi } from "vitest";

import {
  deleteInvoicePaymentFollowUp,
  scheduleInvoicePaymentFollowUp,
} from "./payment-follow-ups";

const INVOICE_ID = "11111111-1111-1111-1111-111111111111";

function makeBuilder(result: unknown) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    upsert: vi.fn(async () => ({ error: null })),
  };
  return builder;
}

describe("deleteInvoicePaymentFollowUp", () => {
  it("deletes the reminder regardless of its current delivery status", async () => {
    const automationBuilder = makeBuilder({ error: null });
    const supabase = { from: vi.fn(() => automationBuilder) };

    await deleteInvoicePaymentFollowUp(supabase as never, INVOICE_ID);

    expect(automationBuilder.delete).toHaveBeenCalledOnce();
    expect(automationBuilder.eq).toHaveBeenNthCalledWith(1, "invoice_id", INVOICE_ID);
    expect(automationBuilder.eq).toHaveBeenNthCalledWith(2, "kind", "payment_follow_up");
  });
});

describe("scheduleInvoicePaymentFollowUp", () => {
  it("anchors the reminder to the actual client delivery, not the draft dates", async () => {
    const invoiceBuilder = makeBuilder({
      data: {
        id: INVOICE_ID,
        status: "issued",
        full_number: "A-000001",
        total: 121,
        clients: { email: "client@example.test" },
      },
      error: null,
    });
    const automationBuilder = makeBuilder({
      data: {
        id: "automation-1",
        invoice_id: INVOICE_ID,
        kind: "payment_follow_up",
        status: "pending",
        run_at: "2030-01-14T15:00:00.000Z",
      },
      error: null,
    });
    const supabase = {
      from: (table: string) => (table === "invoices" ? invoiceBuilder : automationBuilder),
    };

    await scheduleInvoicePaymentFollowUp(
      supabase as never,
      INVOICE_ID,
      "member-1",
      "2030-01-10T15:00:00.000Z",
    );

    expect(automationBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ run_at: "2030-01-14T15:00:00.000Z" }),
      { onConflict: "invoice_id,kind", ignoreDuplicates: true },
    );
  });

  it("uses the latest recorded delivery when a payment is reverted", async () => {
    const invoiceBuilder = makeBuilder({
      data: {
        id: INVOICE_ID,
        status: "issued",
        full_number: "A-000001",
        total: 121,
        clients: { email: "client@example.test" },
      },
      error: null,
    });
    const deliveryBuilder = makeBuilder({
      data: { created_at: "2030-02-01T09:00:00.000Z" },
      error: null,
    });
    const automationBuilder = makeBuilder({
      data: { id: "automation-1", invoice_id: INVOICE_ID, status: "pending" },
      error: null,
    });
    const supabase = {
      from: (table: string) =>
        table === "invoices"
          ? invoiceBuilder
          : table === "invoice_deliveries"
            ? deliveryBuilder
            : automationBuilder,
    };

    await scheduleInvoicePaymentFollowUp(supabase as never, INVOICE_ID, "member-1");

    expect(automationBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ run_at: "2030-02-05T09:00:00.000Z" }),
      { onConflict: "invoice_id,kind", ignoreDuplicates: true },
    );
  });
});
