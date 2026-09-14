import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')

/**
 * Latest migration that (re)defines the versioned item-replacement RPC.
 * Regression guard: recreating this function without payment_plan (as
 * 20260910130000_proposal_legal_annex did) breaks every item save from the
 * editor with "Campos de propuesta no válidos".
 */
function latestFunctionDefinition(): string {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  let definition = ''
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const marker = 'create or replace function public.update_proposal_items_versioned'
    const start = sql.indexOf(marker)
    if (start !== -1) definition = sql.slice(start)
  }
  return definition
}

describe('update_proposal_items_versioned migration', () => {
  const definition = latestFunctionDefinition()

  it('is defined by at least one migration', () => {
    expect(definition).not.toBe('')
  })

  it('admits payment_plan in the patch allowlist alongside legal_terms', () => {
    expect(definition).toMatch(/'payment_schedule',\s*'payment_plan'/)
    expect(definition).toContain("'legal_terms'")
    expect(definition).toContain('Campos de propuesta no válidos')
  })

  it('persists payment_plan so a price-only edit keeps the payment calendar', () => {
    expect(definition).toContain(
      "payment_plan = case when p_patch ? 'payment_plan' then p_patch -> 'payment_plan' else payment_plan end",
    )
  })

  it('keeps execution restricted to authenticated members', () => {
    expect(definition).toContain(
      'revoke all on function public.update_proposal_items_versioned(uuid, bigint, jsonb, jsonb) from public, anon, authenticated',
    )
    expect(definition).toContain(
      'grant execute on function public.update_proposal_items_versioned(uuid, bigint, jsonb, jsonb) to authenticated',
    )
  })
})
