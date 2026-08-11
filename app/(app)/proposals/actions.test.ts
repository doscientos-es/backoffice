import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    rpcArgs: null as Record<string, unknown> | null,
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(async () => ({ id: "member-1" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: async () => ({ data: { status: "draft" }, error: null }) }),
        }),
      }),
    }),
    rpc: async (_name: string, args: Record<string, unknown>) => {
      state.rpcArgs = args;
      return { error: null };
    },
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/google/backup", () => ({ backupProposalToDrive: vi.fn() }));
vi.mock("@/lib/email/render", () => ({ renderEmail: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));

import { updateProposal } from "./actions";

const ID = "494d62cb-fd56-4650-b131-9e3a927a20ad";

describe("updateProposal", () => {
  beforeEach(() => {
    state.rpcArgs = null;
  });

  it("does not pass derived totals to the item-replacement RPC", async () => {
    const result = await updateProposal({
      id: ID,
      title: "Propuesta",
      problems: [{ id: "pair-1", title: "Proceso manual", description: "Mucho trabajo" }],
      solutions: [{ id: "pair-1", title: "Automatizar", description: "Menos trabajo" }],
      items: [
        {
          description: "Implementación",
          quantity: 1,
          unit_price: 1000,
          vat_rate: 21,
          billing_cycle: "none",
        },
      ],
    });

    expect(result).toEqual({ ok: true });
    expect(state.rpcArgs).toMatchObject({ p_proposal_id: ID });
    expect(state.rpcArgs?.p_patch).toEqual({
      title: "Propuesta",
      problems: [{ id: "pair-1", title: "Proceso manual", description: "Mucho trabajo" }],
      solutions: [{ id: "pair-1", title: "Automatizar", description: "Menos trabajo" }],
    });
  });
});
