import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const migration = (name: string) => readFileSync(join(migrationsDir, name), 'utf8')

describe('activity_log migration integrity', () => {
  it('keeps clean replays valid and restores previously removed audit tables', () => {
    expect(migration('20260527180000_cleanup_unused_tables.sql')).not.toContain(
      'drop table if exists public.activity_log',
    )

    const restore = migration('20260910160000_restore_activity_log.sql')
    expect(restore).toContain('create table if not exists public.activity_log')
    expect(restore).toContain('alter table public.activity_log enable row level security')
    expect(restore).toContain('create policy activity_log_select')
  })
})