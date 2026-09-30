import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  delivery: null as Record<string, unknown> | null,
  rpc: vi.fn(),
  activate: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "ua" }),
}));
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/proposals/maintenance-subscription", () => ({
  activateProposalMaintenanceSubscription: state.activate,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.delivery }) }),
      }),
    }),
    rpc: state.rpc,
  }),
}));

import { signDeliveryNote } from "./actions";

const token = "a".repeat(48);
const signature = { signer_name: "Ana Pérez", signer_role: "CEO", accepts_terms: true };
const pending = { id: "d1", proposal_id: "p1", project_id: "pr1", status: "sent" };

describe("signDeliveryNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.delivery = pending;
    state.rpc.mockResolvedValue({ data: "2026-09-30T08:00:00.000Z", error: null });
    state.activate.mockResolvedValue({ ok: true, id: "sub-1" });
  });

  it("rejects an invalid token without touching the database", async () => {
    const res = await signDeliveryNote("nope", signature);
    expect(res).toEqual({ ok: false, error: "Enlace no válido" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown delivery note", async () => {
    state.delivery = null;
    const res = await signDeliveryNote(token, signature);
    expect(res).toEqual({ ok: false, error: "Albarán no encontrado" });
  });

  it.each(["accepted", "superseded", "cancelled"])("rejects a %s note", async (status) => {
    state.delivery = { ...pending, status };
    const res = await signDeliveryNote(token, signature);
    expect(res.ok).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("signs, activates maintenance on the delivery date and revalidates", async () => {
    const res = await signDeliveryNote(token, signature);
    expect(res).toEqual({ ok: true });
    expect(state.rpc).toHaveBeenCalledWith(
      "sign_delivery_acceptance",
      expect.objectContaining({
        p_delivery_acceptance_id: "d1",
        p_signer_name: "Ana Pérez",
        p_ip: "1.2.3.4",
      }),
    );
    expect(state.activate).toHaveBeenCalledWith(expect.anything(), "p1", "2026-09-30T08:00:00.000Z");
    expect(state.revalidatePath).toHaveBeenCalledWith("/subscriptions");
    expect(state.revalidatePath).toHaveBeenCalledWith("/projects/pr1");
  });

  it("fails and skips activation when the RPC errors", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await signDeliveryNote(token, signature);
    expect(res.ok).toBe(false);
    expect(state.activate).not.toHaveBeenCalled();
  });

  it("keeps the signature when subscription activation fails", async () => {
    state.activate.mockResolvedValue({ ok: false, error: "x" });
    const res = await signDeliveryNote(token, signature);
    expect(res).toEqual({ ok: true });
  });
});
