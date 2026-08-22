import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

describe("VERI*FACTU recovery migrations", () => {
  it("uses Alta por rechazo and only unblocks rejected predecessors for X", () => {
    const sql = migration("20260822130000_fix_verifactu_alta_por_rechazo.sql");

    expect(sql).toContain("v_right constant text := $right$'rechazoPrevio', 'X'");
    expect(sql).toContain("$new$l.record_payload->>'rechazoPrevio' = 'X'$new$");
    expect(sql).not.toContain("$new$l.record_payload->>'rechazoPrevio' in ('S', 'X')$new$");
  });

  it("applies the fresh AEAT recipient preflight to every regularization path", () => {
    const sql = migration("20260822131000_verifactu_regularization_common_preflight.sql");

    expect(sql).toContain("Common preflight for every regularization path");
    expect(sql).toContain("v_client.fiscal_verification_status <> 'verified'");
    expect(sql).toContain("clock_timestamp() - interval '24 hours'");
    expect(sql).toContain("v_client.fiscal_verified_nif is distinct from");
    expect(sql).toContain("v_client.fiscal_verified_name is distinct from trim(v_client.name)");
  });
});
