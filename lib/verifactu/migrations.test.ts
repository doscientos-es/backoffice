import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = (name: string) =>
  readFileSync(join(process.cwd(), 'supabase', 'migrations', name), 'utf8')

describe('VERI*FACTU recovery migrations', () => {
  it('uses Alta por rechazo and only unblocks rejected predecessors for X', () => {
    const sql = migration('20260822130000_fix_verifactu_alta_por_rechazo.sql')

    expect(sql).toContain("v_right constant text := $right$'rechazoPrevio', 'X'")
    expect(sql).toContain(
      "v_right constant text := $right$l.record_payload->>'rechazoPrevio' = 'X'$right$",
    )
    expect(sql).toContain(
      "v_wrong constant text := $wrong$l.record_payload->>'rechazoPrevio' in ('S', 'X')$wrong$",
    )
  })

  it('applies the fresh AEAT recipient preflight to every regularization path', () => {
    const sql = migration('20260822131000_verifactu_regularization_common_preflight.sql')

    expect(sql).toContain('Common preflight for every regularization path')
    expect(sql).toContain("v_client.fiscal_verification_status <> 'verified'")
    expect(sql).toContain("clock_timestamp() - interval '24 hours'")
    expect(sql).toContain('v_client.fiscal_verified_nif is distinct from')
    expect(sql).toContain('v_client.fiscal_verified_name is distinct from trim(v_client.name)')
  })

  it('chains recoveries globally and resolves definitive predecessors without deadlock', () => {
    const sql = migration('20260823120000_verifactu_chain_and_latest_alta.sql')

    expect(sql).toContain('A recovery follows the global generation chain')
    expect(sql).toContain('where issuer_nif = v_nif')
    expect(sql).toContain(
      "coalesce(previous_outbox.state, '') not in ('accepted', 'rejected', 'terminal_error')",
    )
    expect(sql).toContain('order by l.chain_sequence desc, l.created_at desc limit 1')
    expect(sql).toContain('v_old_deeper constant text := replace(v_old')
    expect(sql).toContain('elsif position(v_old_deeper in v_definition) > 0 then')
  })
})
