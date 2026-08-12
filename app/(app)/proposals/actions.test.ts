import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    rpcArgs: null as Record<string, unknown> | null,
    inserts: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
    proposal: {
      id: "494d62cb-fd56-4650-b131-9e3a927a20ad",
      number: null as string | null,
      status: "draft",
      title: "Automatización comercial",
      lead_id: "f4e5d6c7-b8a9-4012-8012-123456789abc",
      client_id: null as string | null,
    },
    leadStatus: "in_conversation",
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(async () => ({ id: "member-1" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        like: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (patch: Record<string, unknown>) => {
          state.updates.push({ table, ...patch });
          return builder;
        },
        insert: (row: Record<string, unknown>) => {
          state.inserts.push({ table, ...row });
          return builder;
        },
        maybeSingle: async () => {
          if (table === "proposals") return { data: state.proposal, error: null };
          if (table === "leads") return { data: { status: state.leadStatus }, error: null };
          return { data: null, error: null };
        },
        // biome-ignore lint/suspicious/noThenProperty: intentional Supabase builder mock
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: table === "proposals" ? [] : null, error: null }).then(resolve),
      };
      return builder;
    },
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

import { markProposalAsSent, updateProposal } from "./actions";

const ID = "494d62cb-fd56-4650-b131-9e3a927a20ad";

describe("updateProposal", () => {
  beforeEach(() => {
    state.rpcArgs = null;
    state.inserts = [];
    state.updates = [];
    state.proposal = {
      id: ID,
      number: null,
      status: "draft",
      title: "Automatización comercial",
      lead_id: "f4e5d6c7-b8a9-4012-8012-123456789abc",
      client_id: null,
    };
    state.leadStatus = "in_conversation";
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

  it("returns each invalid field with an actionable label", async () => {
    const result = await updateProposal({
      id: ID,
      items: [
        { description: "", quantity: 0, unit_price: 100, vat_rate: 21, billing_cycle: "none" },
      ],
      scope_modules: [
        { id: "scope-1", title: "", description: null, included: [], excluded: [], notes: null },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Módulo 1 · Nombre: El nombre del módulo es obligatorio\nLínea 1 · Descripción: Descripción obligatoria\nLínea 1 · Cantidad: Cantidad > 0",
    });
  });
});

describe("markProposalAsSent", () => {
  it("syncs a lead-first proposal and queues its 72-hour follow-up", async () => {
    const result = await markProposalAsSent({ id: ID });

    expect(result).toEqual({ ok: true });
    expect(state.updates).toContainEqual(
      expect.objectContaining({ table: "proposals", status: "sent" }),
    );
    expect(state.updates).toContainEqual(
      expect.objectContaining({ table: "leads", status: "quoted" }),
    );
    expect(state.inserts).toContainEqual(
      expect.objectContaining({
        table: "tasks",
        kind: "reminder",
        lead_id: state.proposal.lead_id,
        priority: "high",
      }),
    );
    expect(state.inserts).toContainEqual(
      expect.objectContaining({
        table: "lead_interactions",
        type: "status_change",
        payload: expect.objectContaining({ to: "quoted", proposal_id: ID }),
      }),
    );
  });
});
