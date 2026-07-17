import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  leadSelect: "",
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const builder = {
        select(selection: string) {
          if (table === "leads") state.leadSelect = selection;
          return builder;
        },
        is: () => builder,
        order: () => builder,
        in: () => builder,
        limit: async () => ({
          data: table === "leads" ? state.rows : [],
          error: null,
          count: table === "leads" ? state.rows.length : null,
        }),
      };
      return builder;
    },
  }),
}));

import { listLeads } from "./queries";

describe("listLeads client avatar enrichment", () => {
  beforeEach(() => {
    state.rows = [];
    state.leadSelect = "";
  });

  it("maps the linked client logo and keeps unconverted leads without a client", async () => {
    state.rows = [
      {
        id: "lead-1",
        name: "María García",
        status: "new",
        created_at: "2026-07-16T10:00:00.000Z",
        updated_at: "2026-07-16T10:00:00.000Z",
        client: [{ name: "Acme SL", logo_url: "https://cdn.example/acme.png" }],
      },
      {
        id: "lead-2",
        name: "Jorge Pérez",
        status: "new",
        created_at: "2026-07-15T10:00:00.000Z",
        updated_at: "2026-07-15T10:00:00.000Z",
        client: [],
      },
    ];

    const result = await listLeads({
      view: "board",
      q: "",
      status: null,
      source: null,
      assignee: null,
      attention: null,
      page: 1,
    });

    expect(state.leadSelect).toContain("client:clients!lead_id(name, logo_url)");
    expect(result.leads[0]?.client).toEqual({
      name: "Acme SL",
      logo_url: "https://cdn.example/acme.png",
    });
    expect(result.leads[1]?.client).toBeNull();
  });
});
