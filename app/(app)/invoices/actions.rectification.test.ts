/**
 * invoices/actions.rectification.test.ts
 *
 * Tests the `createRectification` server action in isolation.
 * All DB and auth dependencies are mocked — no real Supabase or network needed.
 *
 * Covered scenarios:
 *  - Happy path R1: returns new invoice id, marks original as rectified
 *  - Happy path R4: same with different type
 *  - Guard: invoice not found → ok:false
 *  - Guard: draft status → ok:false
 *  - Guard: cancelled status → ok:false
 *  - Guard: already rectified status → ok:false
 *  - Guard: is_rectification flag → ok:false
 *  - Guard: role restriction (viewer) → throws
 *  - Validation: missing reason → ok:false
 *  - Validation: invalid UUID → ok:false
 *  - Validation: invalid type → ok:false
 *  - DB error on items fetch → ok:false
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── shared mutable state ───────────────────────────────────────────────────────

const { db, authUser } = vi.hoisted(() => ({
  db: {
    /** Controls what findInvoiceForRectification returns. null = not found. */
    original: null as Record<string, unknown> | null,
    /** Simulates an error fetching invoice_items from supabase directly. */
    itemsError: null as string | null,
    /** Rows passed to insertRectificationWithItems. */
    insertedInvoice: null as Record<string, unknown> | null,
    /** Rows passed to patchInvoiceStatus. */
    patchedStatus: null as Record<string, unknown> | null,
  },
  authUser: {
    id: "user-1",
    name: "Pol",
    email: "pol@doscientos.es",
    role: "admin" as "owner" | "admin" | "member" | "viewer",
    avatarUrl: null,
    emailAlias: null,
    signatureHtml: null,
    emailSendEnabled: false,
    githubHandle: null,
    onboardedAt: "2024-01-01",
    jobTitle: null,
    phone: null,
    contactEmail: null,
  },
}));

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/invoices/queries", () => ({
  findInvoiceForRectification: async () => db.original,
  findNextInvoiceNumberForSeries: async () => 1,
  insertRectificationWithItems: async (invoiceData: Record<string, unknown>) => {
    db.insertedInvoice = invoiceData;
    return { id: "rect-invoice-uuid" };
  },
  patchInvoiceStatus: async (id: string, patch: Record<string, unknown>) => {
    db.patchedStatus = { id, ...patch };
  },
  // Unused in this action but imported by the module — stub to avoid errors.
  findClientInfo: vi.fn(),
  findCompanySettings: vi.fn(),
  findInvoiceForEdit: vi.fn(),
  findInvoiceForEmail: vi.fn(),
  findInvoiceForVerifactu: vi.fn(),
  findInvoiceItemsForVat: vi.fn(),
  findInvoiceSeries: vi.fn(),
  findInvoiceTimestamps: vi.fn(),
  findLastVerifactuChainEntry: vi.fn(),
  findProjectForHourlyBilling: vi.fn(),
  findProposalForInvoice: vi.fn(),
  findProposalItems: vi.fn(),
  findUnlinkedWorkLogsForMonth: vi.fn(),
  insertInvoiceWithItems: vi.fn(),
  linkWorkLogsToInvoice: vi.fn(),
  patchInvoiceAfterVerifactu: vi.fn(),
  patchInvoiceClientSnapshot: vi.fn(),
  patchInvoiceHeader: vi.fn(),
  replaceInvoiceItems: vi.fn(),
  restoreDeletedInvoice: vi.fn(),
  softDeleteInvoice: vi.fn(),
}));

/** Minimal Supabase mock used for the inline invoice_items query inside the action. */
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () =>
          Promise.resolve(
            table === "invoice_items"
              ? {
                  data: db.itemsError
                    ? null
                    : [
                        {
                          position: 0,
                          description: "Servicio",
                          quantity: 1,
                          unit_price: 100,
                          vat_rate: 21,
                        },
                      ],
                  error: db.itemsError ? { message: db.itemsError } : null,
                }
              : { data: null, error: null },
          ),
        // other methods used by different actions — unused here
        insert: () => builder,
        update: () => builder,
        is: () => builder,
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable for Supabase mock
        then: (fn: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          (Promise.resolve({ data: null, error: null }) as Promise<unknown>).then(fn, rej),
      };
      return builder;
    },
    rpc: async () => ({ data: 1, error: null }),
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => authUser,
  requireRole: async (roles: string[]) => {
    if (!roles.includes(authUser.role)) {
      // Mirrors how Next.js redirect() works: defineAction re-throws NEXT_ errors.
      const err = new Error("Forbidden") as Error & { digest?: string };
      err.digest = "NEXT_REDIRECT";
      throw err;
    }
    return authUser;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/lib/verifactu/config", () => ({ verifactuConfigFromEnv: vi.fn() }));
vi.mock("@doscientos/verifactu", () => ({ createVerifactuClient: vi.fn() }));
vi.mock("@/lib/google/backup", () => ({ backupInvoiceToDrive: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/render", () => ({ renderEmail: vi.fn() }));
vi.mock("@/lib/crm/conversion", () => ({ promoteLeadFromClient: vi.fn() }));

// ── SUT ───────────────────────────────────────────────────────────────────────

import { createRectification } from "@/app/(app)/invoices/actions";

// ── fixtures ──────────────────────────────────────────────────────────────────

const ORIG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function issuedInvoice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ORIG_ID,
    status: "issued",
    verifactu_status: "pending",
    invoice_type: "ordinaria",
    full_number: "FAC-2025-001",
    series: "A",
    number: 1,
    issue_date: "2025-01-01",
    client_id: "client-uuid",
    project_id: null,
    client_nif: "12345678Z",
    client_name: "Acme S.L.",
    client_address_street: null,
    client_address_zip: null,
    client_address_city: null,
    client_address_province: null,
    client_address_country: "ES",
    notes: null,
    payment_terms: null,
    subtotal: 1000,
    tax_amount: 210,
    total: 1210,
    is_rectification: false,
    ...overrides,
  };
}

const validInput = {
  originalInvoiceId: ORIG_ID,
  rectificationType: "R1" as const,
  reason: "Error en importe facturado",
};

// ── lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  db.original = issuedInvoice();
  db.itemsError = null;
  db.insertedInvoice = null;
  db.patchedStatus = null;
  authUser.role = "admin";
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("createRectification – happy path", () => {
  it("returns ok:true with the new invoice id", async () => {
    const res = await createRectification(validInput);
    expect(res.ok).toBe(true);
    // defineAction spreads payload into { ok:true, ...payload }
    if (res.ok) expect((res as { ok: true; id: string }).id).toBe("rect-invoice-uuid");
  });

  it("creates the rectification with series R and is_rectification:true", async () => {
    await createRectification(validInput);
    expect(db.insertedInvoice?.series).toBe("R");
    expect(db.insertedInvoice?.is_rectification).toBe(true);
    expect(db.insertedInvoice?.rectified_invoice_id).toBe(ORIG_ID);
    expect(db.insertedInvoice?.invoice_type).toBe("R1");
  });

  it("copies financial totals from the original invoice", async () => {
    await createRectification(validInput);
    expect(db.insertedInvoice?.subtotal).toBe(1000);
    expect(db.insertedInvoice?.tax_amount).toBe(210);
    expect(db.insertedInvoice?.total).toBe(1210);
  });

  it("stores the rectification reason", async () => {
    await createRectification(validInput);
    expect(db.insertedInvoice?.rectification_reason).toBe(validInput.reason);
  });

  it("marks the original invoice as rectified", async () => {
    await createRectification(validInput);
    expect(db.patchedStatus?.id).toBe(ORIG_ID);
    expect(db.patchedStatus?.status).toBe("rectified");
  });

  it("works for R4 type as well", async () => {
    const res = await createRectification({ ...validInput, rectificationType: "R4" });
    expect(res.ok).toBe(true);
    expect(db.insertedInvoice?.invoice_type).toBe("R4");
  });

  it("works for paid invoices", async () => {
    db.original = issuedInvoice({ status: "paid" });
    const res = await createRectification(validInput);
    expect(res.ok).toBe(true);
  });

  it("works for overdue invoices", async () => {
    db.original = issuedInvoice({ status: "overdue" });
    const res = await createRectification(validInput);
    expect(res.ok).toBe(true);
  });
});

describe("createRectification – business rule guards", () => {
  it("fails when original invoice is not found", async () => {
    db.original = null;
    const res = await createRectification(validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no encontrada/i);
  });

  it("fails when original is in draft status", async () => {
    db.original = issuedInvoice({ status: "draft" });
    const res = await createRectification(validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/emitidas/i);
  });

  it("fails when original is cancelled", async () => {
    db.original = issuedInvoice({ status: "cancelled" });
    const res = await createRectification(validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/emitidas/i);
  });

  it("fails when original is already rectified", async () => {
    db.original = issuedInvoice({ status: "rectified" });
    const res = await createRectification(validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/emitidas/i);
  });

  it("fails when the invoice is itself a rectification", async () => {
    db.original = issuedInvoice({ is_rectification: true });
    const res = await createRectification(validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/rectificativa/i);
  });
});

describe("createRectification – role restriction", () => {
  it("throws for viewer role (not in allowed list)", async () => {
    authUser.role = "viewer";
    await expect(createRectification(validInput)).rejects.toThrow();
  });

  it("allows owner role", async () => {
    authUser.role = "owner";
    const res = await createRectification(validInput);
    expect(res.ok).toBe(true);
  });
});

describe("createRectification – input validation", () => {
  it("fails when reason is empty", async () => {
    const res = await createRectification({ ...validInput, reason: "" });
    expect(res.ok).toBe(false);
  });

  it("fails when originalInvoiceId is not a UUID", async () => {
    const res = await createRectification({
      ...validInput,
      originalInvoiceId: "not-a-uuid",
    });
    expect(res.ok).toBe(false);
  });

  it("fails for invalid rectification type", async () => {
    const res = await createRectification({
      ...validInput,
      rectificationType: "R2" as "R1",
    });
    expect(res.ok).toBe(false);
  });
});

describe("createRectification – DB errors", () => {
  it("returns ok:false when fetching items fails", async () => {
    db.itemsError = "connection timeout";
    const res = await createRectification(validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("connection timeout");
  });
});
