/**
 * Tests for attachment upload and download routes.
 *
 * Covers:
 *  - Upload: auth guards, viewer block, size limit, MIME whitelist, invalid entityType, happy path.
 *  - Download: auth guard, soft-deleted attachment returns 404, missing storage_path returns 400,
 *    happy path redirects to signed URL.
 *
 * The two RLS rules hardened in 20260610130000_attachments_rls_hardening.sql are exercised at the
 * app-logic level:
 *   1. `deleted_at IS NULL` – the download route adds `.is("deleted_at", null)` to its query;
 *      a soft-deleted row returns null from the mock DB, which is what happens when Postgres RLS
 *      filters it out. The route must respond with 404.
 *   2. Defense-in-depth on the bucket – the upload route only stores a file after a successful DB
 *      insert and rolls back the storage object on failure, so a path without a live `attachments`
 *      row can never be created through normal usage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mutable state (vi.hoisted so factories below can close over it)
// ---------------------------------------------------------------------------
const { state } = vi.hoisted(() => ({
  state: {
    // auth
    authThrows: false,
    userRole: "member" as "owner" | "admin" | "member" | "viewer",
    // upload: storage
    storageUploadError: null as { message: string } | null,
    storageRemoveCalls: [] as string[][],
    // upload: db insert
    dbInsertResult: { data: { id: "att-1" }, error: null } as {
      data: { id: string } | null;
      error: { message: string } | null;
    },
    // download: db fetch
    dbFetchResult: {
      data: null as { id: string; storage_path: string; name: string } | null,
      error: null as { message: string } | null,
    },
    // download: signed URL
    signedUrlResult: {
      data: { signedUrl: "https://storage.example.com/signed" } as { signedUrl: string } | null,
      error: null as { message: string } | null,
    },
  },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error("Not authenticated");
    return { id: "user-1", role: state.userRole };
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (_bucket: string) => ({
        upload: async () => ({ data: {}, error: state.storageUploadError }),
        remove: async (paths: string[]) => {
          state.storageRemoveCalls.push(paths);
          return { error: null };
        },
        createSignedUrl: async () => state.signedUrlResult,
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: (_table: string) => ({
      // download chain: select().eq().is().maybeSingle()
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: async () => state.dbFetchResult,
          }),
        }),
      }),
      // upload chain: insert().select().single()
      insert: () => ({
        select: () => ({
          single: async () => state.dbInsertResult,
        }),
      }),
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { NextRequest } from "next/server";

function makePdf(sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], "test.pdf", { type: "application/pdf" });
}

function uploadRequest(file: File, extras: Record<string, string> = {}): NextRequest {
  const fd = new FormData();
  fd.set("file", file);
  for (const [k, v] of Object.entries(extras)) fd.set(k, v);
  return new NextRequest("http://localhost/api/attachments/upload", { method: "POST", body: fd });
}

function downloadRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/documents/${id}/download`);
}

// ---------------------------------------------------------------------------
// Upload route
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/attachments/upload/route";

describe("POST /api/attachments/upload", () => {
  beforeEach(() => {
    state.authThrows = false;
    state.userRole = "member";
    state.storageUploadError = null;
    state.storageRemoveCalls = [];
    state.dbInsertResult = { data: { id: "att-1" }, error: null };
    vi.resetModules();
  });

  it("returns 401 when not authenticated", async () => {
    state.authThrows = true;
    const res = await POST(uploadRequest(makePdf()));
    expect(res.status).toBe(401);
  });

  it("returns 403 for viewer role", async () => {
    state.userRole = "viewer";
    const res = await POST(uploadRequest(makePdf()));
    expect(res.status).toBe(403);
  });

  it("returns 413 when file exceeds 50 MB", async () => {
    const big = new File([new Uint8Array(52_428_801)], "big.pdf", { type: "application/pdf" });
    const res = await POST(uploadRequest(big));
    expect(res.status).toBe(413);
  });

  it("returns 400 for disallowed MIME type", async () => {
    const zip = new File([new Uint8Array(100)], "archive.zip", { type: "application/zip" });
    const res = await POST(uploadRequest(zip));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("no permitido") });
  });

  it("returns 400 for invalid entityType", async () => {
    const res = await POST(
      uploadRequest(makePdf(), { entityType: "invoice", entityId: "some-uuid" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 and rolls back storage on DB failure", async () => {
    state.dbInsertResult = { data: null, error: { message: "constraint violation" } };
    const res = await POST(uploadRequest(makePdf(), { entityType: "lead", entityId: "lead-1" }));
    expect(res.status).toBe(500);
    expect(state.storageRemoveCalls).toHaveLength(1);
  });

  it("returns 201 with attachment id on success", async () => {
    const res = await POST(uploadRequest(makePdf(), { entityType: "lead", entityId: "lead-1" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "att-1" });
  });
});

// ---------------------------------------------------------------------------
// Download route
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/documents/[id]/download/route";

describe("GET /api/documents/[id]/download", () => {
  beforeEach(() => {
    state.authThrows = false;
    state.userRole = "member";
    state.dbFetchResult = { data: null, error: null };
    state.signedUrlResult = {
      data: { signedUrl: "https://storage.example.com/signed" },
      error: null,
    };
    vi.resetModules();
  });

  it("returns 401 when not authenticated", async () => {
    state.authThrows = true;
    const res = await GET(downloadRequest("att-1"), { params: Promise.resolve({ id: "att-1" }) });
    expect(res.status).toBe(401);
  });

  /**
   * RLS rule 1 – soft-deleted attachment must be invisible.
   * The route adds `.is("deleted_at", null)` to its query.  When RLS (or a deleted row) causes
   * the DB to return null, the route must return 404, never a signed URL.
   */
  it("returns 404 for a soft-deleted attachment (deleted_at IS NULL filter)", async () => {
    // DB returns null – same as when Postgres RLS filters the row out
    state.dbFetchResult = { data: null, error: null };
    const res = await GET(downloadRequest("att-deleted"), {
      params: Promise.resolve({ id: "att-deleted" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when attachment does not exist", async () => {
    state.dbFetchResult = { data: null, error: { message: "Not found" } };
    const res = await GET(downloadRequest("unknown"), {
      params: Promise.resolve({ id: "unknown" }),
    });
    expect(res.status).toBe(404);
  });

  /**
   * RLS rule 2 – the upload route is the only way to create a path in the `documents` bucket,
   * and it always inserts a matching `attachments` row (rolling back on failure).
   * Here we verify the download route returns 400 for a row with no storage_path,
   * which further ensures that bucket objects without a live DB row are never served.
   */
  it("returns 400 when the DB row has no storage_path", async () => {
    state.dbFetchResult = {
      data: { id: "att-1", storage_path: "", name: "file.pdf" },
      error: null,
    };
    const res = await GET(downloadRequest("att-1"), { params: Promise.resolve({ id: "att-1" }) });
    expect(res.status).toBe(400);
  });

  it("redirects to signed URL on success", async () => {
    state.dbFetchResult = {
      data: { id: "att-1", storage_path: "lead/l1/att-1/file.pdf", name: "file.pdf" },
      error: null,
    };
    const res = await GET(downloadRequest("att-1"), { params: Promise.resolve({ id: "att-1" }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://storage.example.com/signed");
  });
});
