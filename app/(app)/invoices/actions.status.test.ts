import { beforeEach, describe, expect, it, vi } from "vitest";

const { backupInvoiceToDrive, deliverVerifactuOutbox, rpc, syncInvoiceQrFromLedger } = vi.hoisted(
  () => ({
    backupInvoiceToDrive: vi.fn(),
    deliverVerifactuOutbox: vi.fn(),
    rpc: vi.fn(),
    syncInvoiceQrFromLedger: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({
  requireRole: async () => ({ id: "user-1", email: "admin@example.test", role: "admin" }),
  requireUser: async () => ({ id: "user-1", email: "admin@example.test", role: "admin" }),
}));
vi.mock("@/lib/google/backup", () => ({ backupInvoiceToDrive }));
vi.mock("@/lib/security/user-verification", () => ({ consumeUserVerification: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({ rpc }) }));
vi.mock("@/lib/verifactu/outbox", () => ({
  assertDurableVerifactuPackage: vi.fn(),
  deliverInvoiceVerifactu: vi.fn(),
  deliverVerifactuOutbox,
  syncInvoiceQrFromLedger,
}));
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { updateInvoiceStatus } from "./actions";

const INVOICE_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  rpc.mockResolvedValue({ data: [{ outbox_id: "outbox-1" }], error: null });
  deliverVerifactuOutbox.mockResolvedValue({ processed: true, status: "accepted", csv: "CSV-1" });
  backupInvoiceToDrive.mockReset();
  syncInvoiceQrFromLedger.mockReset();
});

describe("updateInvoiceStatus fiscal flow", () => {
  it("creates an Alta ledger/outbox before attempting immediate delivery", async () => {
    const result = await updateInvoiceStatus({ id: INVOICE_ID, status: "issued" });

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("issue_invoice_with_verifactu_outbox", {
      p_invoice_id: INVOICE_ID,
    });
    expect(deliverVerifactuOutbox).toHaveBeenCalledWith(
      "outbox-1",
      expect.stringMatching(/^action:/),
    );
    expect(syncInvoiceQrFromLedger).toHaveBeenCalledWith(INVOICE_ID);
    expect(backupInvoiceToDrive).toHaveBeenCalledWith(INVOICE_ID, "admin@example.test");
  });

  it("creates a RegistroAnulacion outbox instead of directly cancelling", async () => {
    const result = await updateInvoiceStatus({ id: INVOICE_ID, status: "cancelled" });

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("cancel_invoice_with_verifactu_outbox", {
      p_invoice_id: INVOICE_ID,
    });
    expect(backupInvoiceToDrive).not.toHaveBeenCalled();
    expect(syncInvoiceQrFromLedger).not.toHaveBeenCalled();
  });
});
