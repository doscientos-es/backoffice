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

  it('adds protected central audit and privacy workflow primitives', () => {
    const governedOperations = migration('20260910170000_governed_data_operations.sql')
    expect(governedOperations).toContain('create table if not exists public.audit_events')
    expect(governedOperations).toContain(
      'revoke all on public.audit_events from anon, authenticated',
    )
    expect(governedOperations).toContain('create table if not exists public.privacy_requests')
    expect(governedOperations).toContain('create table if not exists public.privacy_legal_holds')
    expect(governedOperations).toContain(
      'create table if not exists public.data_processing_consents',
    )
    expect(migration('20260910180000_schedule_lead_pii_anonymization.sql')).toContain(
      'privacy_anonymized_at',
    )
  })

  it('surfaces scoped audit metadata without exposing before/after snapshots', () => {
    const auditTimeline = migration('20261009120000_surface_entity_audit_timeline.sql')
    expect(auditTimeline).toContain("jsonb_build_object('changed_fields', changed_fields)")
    expect(auditTimeline).toContain('public.can_access_lead(p_entity_id)')
    expect(auditTimeline).toContain('public.can_access_client(p_entity_id)')
    expect(auditTimeline).toContain('public.can_access_project(p_entity_id)')
    expect(auditTimeline).toContain(
      'revoke all on function public.list_entity_audit_timeline(text, uuid, integer) from public, anon, authenticated',
    )
    expect(auditTimeline).toContain(
      'grant execute on function public.list_entity_audit_timeline(text, uuid, integer) to authenticated',
    )
    expect(auditTimeline).not.toContain('before_data jsonb,\n  after_data jsonb')
  })
})
