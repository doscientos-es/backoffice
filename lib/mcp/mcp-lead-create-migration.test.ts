import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260929120000_mcp_create_lead.sql"),
  "utf8",
);

describe("MCP lead creation migration", () => {
  it("keeps lead creation behind the token-checked RPC without granting direct table writes", () => {
    expect(migration).toContain("public.has_valid_mcp_access_token()");
    expect(migration).toContain("create or replace function public.mcp_create_lead");
    expect(migration).toContain("security definer");
    expect(migration).toContain("grant execute on function public.mcp_create_lead(jsonb, uuid) to anon, authenticated");
    expect(migration).not.toContain("grant insert on table public.leads");
  });

  it("validates the active lead owner and safely creates an idempotent lead and follow-up", () => {
    expect(migration).toContain("where id = v_assigned_to and deleted_at is null and leads_assignable");
    expect(migration).toContain("on conflict (mcp_idempotency_key)");
    expect(migration).toContain("'new'");
    expect(migration).toContain("'reminder'");
    expect(migration).toContain("'mcp.created'");
  });
});