-- Retention job marker: only soft-deleted leads may be automatically anonymized.
-- Active records and any record protected by privacy_legal_holds always require review.

alter table public.leads
  add column if not exists privacy_anonymized_at timestamptz;

create index if not exists leads_privacy_retention_idx
  on public.leads(deleted_at)
  where deleted_at is not null and privacy_anonymized_at is null;

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20260910180000', 'schedule_lead_pii_anonymization', array['add lead privacy anonymization marker and retention index'])
on conflict (version) do nothing;