import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, update, finish } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  update: vi.fn(),
  finish: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ id: "member-1", role: "member" }),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  cancelInvoicePaymentFollowUpAction,
  rescheduleInvoicePaymentFollowUpAction,
} from "./automation-actions";

const INVOICE_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  finish.mockReset().mockResolvedValue({ error: null });
  update.mockReset().mockImplementation(() => ({
    eq: () => ({
      eq: () => ({ in: finish }),
    }),
  }));
  createServerClient.mockResolvedValue({ from: () => ({ update }) });
});

describe("invoice payment follow-up actions", () => {
  it("cancels the pending automatic email for an invoice", async () => {
    const result = await cancelInvoicePaymentFollowUpAction({ invoiceId: INVOICE_ID });

    expect(result).toMatchObject({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", cancelled_at: expect.any(String) }),
    );
  });

  it("reschedules the email without sending it immediately", async () => {
    const runAt = "2030-01-02T10:00:00.000Z";
    const result = await rescheduleInvoicePaymentFollowUpAction({ invoiceId: INVOICE_ID, runAt });

    expect(result).toMatchObject({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", run_at: runAt }),
    );
  });
});
