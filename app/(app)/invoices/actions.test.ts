import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    proposal: {
      id: "494d62cb-fd56-4650-b131-9e3a927a20ad",
      status: "accepted",
      title: "Automatización comercial",
    },
    role: "member" as "member" | "viewer",
    notifications: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(async () => ({
    id: "member-1",
    name: "Pol",
    role: state.role,
  })),
}));

vi.mock("@/lib/invoices/queries", () => ({
  findProposalForInvoice: vi.fn(async () => state.proposal),
}));

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchNotifications: vi.fn(async (notification) => state.notifications.push(notification)),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: () => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        in: () => builder,
        is: () => builder,
        // biome-ignore lint/suspicious/noThenProperty: intentional Supabase builder mock
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [{ id: "admin-1" }], error: null }).then(resolve),
      };
      return builder;
    },
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { requestInvoiceFromProposal } from "./actions";

const PROPOSAL_ID = "494d62cb-fd56-4650-b131-9e3a927a20ad";

beforeEach(() => {
  state.proposal.status = "accepted";
  state.role = "member";
  state.notifications = [];
});

describe("requestInvoiceFromProposal", () => {
  it("notifies administration for an accepted proposal requested by a commercial", async () => {
    const result = await requestInvoiceFromProposal({ proposalId: PROPOSAL_ID });

    expect(result).toEqual({ ok: true });
    expect(state.notifications).toEqual([
      expect.objectContaining({
        recipientIds: ["admin-1"],
        actorId: "member-1",
        eventType: "invoice_requested",
        entityId: PROPOSAL_ID,
        link: `/proposals/${PROPOSAL_ID}`,
      }),
    ]);
  });

  it("does not allow viewers to request an invoice", async () => {
    state.role = "viewer";

    const result = await requestInvoiceFromProposal({ proposalId: PROPOSAL_ID });

    expect(result).toEqual({ ok: false, error: "No tienes permiso para solicitar facturación" });
    expect(state.notifications).toEqual([]);
  });
});
