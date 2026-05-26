import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

type ProposalRow = { id: string; status: string } | null;
type FetchResult = { data: ProposalRow; error: unknown };
type UpdateResult = { error: unknown };

const state: {
  fetchResult: FetchResult;
  updateResult: UpdateResult;
  lastPatch: Record<string, unknown> | null;
  lastUpdateId: string | null;
} = {
  fetchResult: { data: null, error: null },
  updateResult: { error: null },
  lastPatch: null,
  lastUpdateId: null,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: async () => state.fetchResult,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        state.lastPatch = patch;
        return {
          eq: async (_col: string, id: string) => {
            state.lastUpdateId = id;
            return state.updateResult;
          },
        };
      },
    }),
  }),
}));

const VALID_TOKEN = "a".repeat(48);

describe("portal proposal actions", () => {
  beforeEach(() => {
    state.fetchResult = { data: null, error: null };
    state.updateResult = { error: null };
    state.lastPatch = null;
    state.lastUpdateId = null;
    revalidatePath.mockClear();
  });

  it("rejects malformed tokens without touching the DB", async () => {
    const { acceptProposal } = await import("@/app/p/proposal/[token]/actions");
    const result = await acceptProposal("short");
    expect(result).toEqual({ ok: false, error: "Token inválido" });
    expect(state.lastPatch).toBeNull();
  });

  it("returns not-found when the proposal does not exist", async () => {
    const { acceptProposal } = await import("@/app/p/proposal/[token]/actions");
    state.fetchResult = { data: null, error: null };

    const result = await acceptProposal(VALID_TOKEN);
    expect(result).toEqual({ ok: false, error: "Propuesta no encontrada" });
  });

  it("blocks transitions from already-responded states", async () => {
    const { acceptProposal, rejectProposal } = await import("@/app/p/proposal/[token]/actions");

    state.fetchResult = { data: { id: "p1", status: "accepted" }, error: null };
    expect(await acceptProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: "Esta propuesta ya ha sido respondida",
    });

    state.fetchResult = { data: { id: "p1", status: "rejected" }, error: null };
    expect(await rejectProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: "Esta propuesta ya ha sido respondida",
    });
  });

  it("blocks transitions from draft or expired", async () => {
    const { acceptProposal } = await import("@/app/p/proposal/[token]/actions");

    state.fetchResult = { data: { id: "p1", status: "draft" }, error: null };
    expect(await acceptProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: "Propuesta no disponible",
    });

    state.fetchResult = { data: { id: "p1", status: "expired" }, error: null };
    expect(await acceptProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: "Propuesta expirada",
    });
  });

  it("accepts a sent proposal and revalidates the portal path", async () => {
    const { acceptProposal } = await import("@/app/p/proposal/[token]/actions");
    state.fetchResult = { data: { id: "p1", status: "sent" }, error: null };

    const result = await acceptProposal(VALID_TOKEN);
    expect(result).toEqual({ ok: true });
    expect(state.lastUpdateId).toBe("p1");
    expect(state.lastPatch?.status).toBe("accepted");
    expect(typeof state.lastPatch?.responded_at).toBe("string");
    expect(revalidatePath).toHaveBeenCalledWith(`/p/proposal/${VALID_TOKEN}`);
  });

  it("rejects a viewed proposal and stores the rejection reason", async () => {
    const { rejectProposal } = await import("@/app/p/proposal/[token]/actions");
    state.fetchResult = { data: { id: "p2", status: "viewed" }, error: null };

    const result = await rejectProposal(VALID_TOKEN, "No es lo que buscamos");
    expect(result).toEqual({ ok: true });
    expect(state.lastPatch?.status).toBe("rejected");
    expect(state.lastPatch?.signature_data).toEqual({
      rejection_reason: "No es lo que buscamos",
    });
  });

  it("omits signature_data when no rejection reason is provided", async () => {
    const { rejectProposal } = await import("@/app/p/proposal/[token]/actions");
    state.fetchResult = { data: { id: "p3", status: "sent" }, error: null };

    await rejectProposal(VALID_TOKEN);
    expect(state.lastPatch?.signature_data).toBeUndefined();
  });

  it("surfaces DB update errors", async () => {
    const { acceptProposal } = await import("@/app/p/proposal/[token]/actions");
    state.fetchResult = { data: { id: "p4", status: "sent" }, error: null };
    state.updateResult = { error: { message: "db down" } };

    const result = await acceptProposal(VALID_TOKEN);
    expect(result).toEqual({ ok: false, error: "No se pudo actualizar la propuesta" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
