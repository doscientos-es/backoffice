import { describe, expect, it } from "vitest";

import {
  activateProposalMaintenanceSubscription,
  ensureProposalMaintenanceSubscription,
} from "./maintenance-subscription";

type Row = Record<string, unknown>;

/** Minimal chainable Supabase fake: records inserts/updates, returns canned rows. */
function fakeClient(opts: { proposal: Row | null; existingSub?: Row | null; insertError?: Row }) {
  const calls = { inserts: [] as Row[], updates: [] as { values: Row; filters: Row }[] };
  const from = (table: string) => {
    let mode: "select" | "insert" | "update" = "select";
    let values: Row = {};
    const filters: Row = {};
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      is: chain,
      eq: (key: string, value: unknown) => {
        filters[key] = value;
        return builder;
      },
      insert: (v: Row) => {
        mode = "insert";
        values = v;
        calls.inserts.push(v);
        return builder;
      },
      update: (v: Row) => {
        mode = "update";
        values = v;
        return builder;
      },
      maybeSingle: async () => ({
        data: table === "proposals" ? opts.proposal : (opts.existingSub ?? null),
        error: null,
      }),
      single: async () =>
        opts.insertError
          ? { data: null, error: opts.insertError }
          : { data: { id: "sub-new" }, error: null },
      then: (resolve: (v: unknown) => void) => {
        if (mode === "update") calls.updates.push({ values, filters });
        resolve({ error: null });
      },
    });
    return builder;
  };
  // biome-ignore lint/suspicious/noExplicitAny: test double
  return { client: { from } as any, calls };
}

const offer = {
  enabled: true,
  heading: "Mantenimiento",
  intro: "Intro",
  billing_cycle: "monthly",
  plans: [
    {
      id: "p1",
      name: "Básico",
      summary: "x",
      monthly_price: 50,
      vat_rate: 21,
      coverage: ["Soporte"],
      exclusions: [],
    },
  ],
};
const acceptedProposal = {
  id: "prop-1",
  number: "P-1",
  title: "Web",
  status: "accepted",
  client_id: "c1",
  project_id: "pr1",
  responded_at: "2026-09-01T10:00:00.000Z",
  maintenance_options: offer,
  maintenance_selected_plan_id: "p1",
};

describe("ensureProposalMaintenanceSubscription", () => {
  it("rejects proposals that are not accepted", async () => {
    const { client } = fakeClient({ proposal: { ...acceptedProposal, status: "sent" } });
    const res = await ensureProposalMaintenanceSubscription(client, "prop-1", null);
    expect(res.ok).toBe(false);
  });

  it("returns the existing subscription without inserting", async () => {
    const { client, calls } = fakeClient({
      proposal: acceptedProposal,
      existingSub: { id: "sub-1" },
    });
    const res = await ensureProposalMaintenanceSubscription(client, "prop-1", null);
    expect(res).toEqual({ ok: true, id: "sub-1" });
    expect(calls.inserts).toHaveLength(0);
  });

  it("returns id null without a plan when requirePlan is false", async () => {
    const { client } = fakeClient({
      proposal: { ...acceptedProposal, maintenance_selected_plan_id: null },
    });
    const res = await ensureProposalMaintenanceSubscription(client, "prop-1", null, {
      requirePlan: false,
    });
    expect(res).toEqual({ ok: true, id: null });
  });

  it("creates a paused subscription when none exists", async () => {
    const { client, calls } = fakeClient({ proposal: acceptedProposal });
    const res = await ensureProposalMaintenanceSubscription(client, "prop-1", "u1");
    expect(res).toEqual({ ok: true, id: "sub-new" });
    expect(calls.inserts[0]).toMatchObject({ status: "paused", proposal_id: "prop-1" });
  });
});

describe("activateProposalMaintenanceSubscription", () => {
  it("activates the paused subscription starting on the delivery date", async () => {
    const { client, calls } = fakeClient({
      proposal: acceptedProposal,
      existingSub: { id: "sub-1" },
    });
    const res = await activateProposalMaintenanceSubscription(
      client,
      "prop-1",
      "2026-09-30T08:00:00.000Z",
    );
    expect(res).toEqual({ ok: true, id: "sub-1" });
    expect(calls.updates[0]).toEqual({
      values: { status: "active", start_date: "2026-09-30", next_invoice_date: "2026-09-30" },
      filters: { id: "sub-1", status: "paused" },
    });
  });

  it("is a no-op when the proposal has no maintenance plan", async () => {
    const { client, calls } = fakeClient({
      proposal: { ...acceptedProposal, maintenance_selected_plan_id: null },
    });
    const res = await activateProposalMaintenanceSubscription(
      client,
      "prop-1",
      "2026-09-30T08:00:00.000Z",
    );
    expect(res).toEqual({ ok: true, id: null });
    expect(calls.updates).toHaveLength(0);
  });
});
