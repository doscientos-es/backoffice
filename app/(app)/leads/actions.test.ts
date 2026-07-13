/**
 * leads/actions.test.ts – Server Actions E2E
 *
 * Tests the full server-action pipeline (auth guard → validation → DB → revalidate)
 * using mocked Supabase and auth layer. No real DB or network needed.
 *
 * Covered actions:
 *  - createLead    → inserts row, fires background notification, returns id
 *  - deleteLead    → soft-deletes; enforces owner/admin role restriction
 *  - updateLead    → patches fields; available to member+
 *  - updateLeadStatus → updates status + logs interaction in timeline
 *  - claimLead     → assigns unowned lead; errors on already-owned
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── shared DB state ───────────────────────────────────────────────────────────

const { db, authUser } = vi.hoisted(() => ({
  db: {
    insertedRows: [] as Record<string, unknown>[],
    updatedRows: [] as Record<string, unknown>[],
    queryError: null as string | null,
    leadStatus: "new" as string,
  },
  authUser: {
    id: "member-1",
    name: "Pol",
    email: "pol@doscientos.es",
    role: "admin" as "owner" | "admin" | "member" | "viewer",
    avatarUrl: null,
    emailAlias: null,
    signatureHtml: null,
    githubHandle: null,
    onboardedAt: "2024-01-01",
    jobTitle: null,
    phone: null,
    contactEmail: null,
  },
}));

// ── mocks ─────────────────────────────────────────────────────────────────────

/**
 * Supabase builder mock.
 *
 * Every method returns the SAME builder so the call chain can be arbitrarily
 * deep (`.update().eq().is().select().maybeSingle()`). The builder is also a
 * thenable so `await builder.update({}).eq(...)` resolves correctly.
 */
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      // Resolved value for terminal awaits (.single, .maybeSingle, or direct await)
      const resolve = () => ({
        data: db.queryError
          ? null
          : table === "leads"
            ? { id: "new-lead-uuid", status: db.leadStatus }
            : { id: "interaction-uuid" },
        error: db.queryError ? { message: db.queryError } : null,
      });

      // Builder: all chainable methods return itself; terminal methods are async.
      const builder: Record<string, unknown> = {
        insert(row: Record<string, unknown>) {
          db.insertedRows.push({ table, ...row });
          return builder;
        },
        update(patch: Record<string, unknown>) {
          db.updatedRows.push({ table, ...patch });
          return builder;
        },
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        is() {
          return builder;
        },
        in() {
          return builder;
        },
        async single() {
          return resolve();
        },
        async maybeSingle() {
          if (table === "leads" && db.queryError)
            return { data: null, error: { message: db.queryError } };
          // claimLead checks `.is("assigned_to", null)` → return a row with id
          return { data: { id: "lead-1" }, error: null };
        },
        // Makes `await builder` work (thenable protocol).
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable for Supabase mock
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve(resolve()).then(onFulfilled);
        },
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => authUser,
  requireRole: async (roles: string[]) => {
    if (!roles.includes(authUser.role)) {
      const err = new Error("Forbidden") as Error & { digest?: string };
      err.digest = "NEXT_REDIRECT";
      throw err;
    }
    return authUser;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/integrations/notify-new-lead", () => ({
  notifyNewLead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ── SUT ───────────────────────────────────────────────────────────────────────

import {
  claimLead,
  createLead,
  deleteLead,
  updateLead,
  updateLeadStatus,
} from "@/app/(app)/leads/actions";

// ── helpers ───────────────────────────────────────────────────────────────────

function lead(overrides?: Record<string, unknown>) {
  return {
    name: "Empresa Test",
    source: "manual" as const,
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  db.insertedRows = [];
  db.updatedRows = [];
  db.queryError = null;
  db.leadStatus = "new";
  authUser.role = "admin";
});

describe("createLead", () => {
  it("returns ok:true with the new lead id", async () => {
    const result = await createLead(lead());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe("new-lead-uuid");
  });

  it("includes created_by from the authenticated user", async () => {
    await createLead(lead());
    const inserted = db.insertedRows.find((r) => r.table === "leads");
    expect(inserted?.created_by).toBe("member-1");
  });

  it("returns ok:false with a message when the DB fails", async () => {
    db.queryError = "duplicate key";
    const result = await createLead(lead());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate key");
  });

  it("fails validation when name is missing", async () => {
    const result = await createLead({} as Parameters<typeof createLead>[0]);
    expect(result.ok).toBe(false);
  });
});

describe("deleteLead", () => {
  it("succeeds for admin role", async () => {
    authUser.role = "admin";
    const result = await deleteLead({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(true);
  });

  it("is restricted to owner/admin (throws redirect for member)", async () => {
    authUser.role = "member";
    // requireRole throws a framework error → defineAction re-throws it
    await expect(deleteLead({ id: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow();
  });

  it("fails validation when id is not a UUID", async () => {
    const result = await deleteLead({ id: "not-a-uuid" });
    expect(result.ok).toBe(false);
  });
});

describe("updateLead", () => {
  it("returns ok:true for a valid patch", async () => {
    const result = await updateLead({
      id: "00000000-0000-0000-0000-000000000001",
      name: "Updated Name",
    });
    expect(result.ok).toBe(true);
  });

  it("sets updated_by to the current user", async () => {
    await updateLead({ id: "00000000-0000-0000-0000-000000000001", name: "X" });
    const row = db.updatedRows.find((r) => r.table === "leads");
    expect(row?.updated_by).toBe("member-1");
  });
});

describe("updateLeadStatus", () => {
  it("returns ok:true when the update succeeds", async () => {
    const result = await updateLeadStatus({
      leadId: "00000000-0000-0000-0000-000000000001",
      status: "qualifying",
    });
    expect(result.ok).toBe(true);
  });

  it("sets lost_reason when closing as lost", async () => {
    await updateLeadStatus({
      leadId: "00000000-0000-0000-0000-000000000001",
      status: "lost",
      lostReason: "Budget no fit",
    });
    const row = db.updatedRows.find((r) => r.table === "leads");
    expect(row?.lost_reason).toBe("Budget no fit");
  });

  it("clears lost_reason when re-opening", async () => {
    await updateLeadStatus({
      leadId: "00000000-0000-0000-0000-000000000001",
      status: "qualifying",
    });
    const row = db.updatedRows.find((r) => r.table === "leads");
    expect(row?.lost_reason).toBeNull();
  });
});

describe("claimLead", () => {
  it("returns ok:true when lead has no owner", async () => {
    const result = await claimLead({ leadId: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(true);
  });
});
