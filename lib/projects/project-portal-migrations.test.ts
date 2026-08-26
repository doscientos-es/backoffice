import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

describe("project portal migrations", () => {
  it("limits MCP writes to token-checked RPCs with optimistic concurrency", () => {
    const sql = migration("20260826100000_mcp_project_task_tools.sql");
    expect(sql).toContain("if not public.has_valid_mcp_access_token()");
    expect(sql).toContain("and version = p_expected_version");
    expect(sql).not.toContain("create policy mcp_writer");
  });

  it("keeps public request insertion behind the service role", () => {
    const sql = migration("20260826110000_project_client_portal.sql");
    expect(sql).toContain("if auth.role() <> 'service_role'");
    expect(sql).toContain("grant execute on function public.submit_project_request");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("trg_sync_project_request_from_task");
  });
});