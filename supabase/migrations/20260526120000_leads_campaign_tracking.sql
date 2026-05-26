-- ============================================================
-- leads: campaign tracking + external ingestion (Meta, Google, etc.)
-- ============================================================

alter table public.leads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists referrer text,
  add column if not exists ip text,
  add column if not exists device text,
  add column if not exists browser text,
  add column if not exists language text,
  add column if not exists external_id text,
  add column if not exists external_source text,
  add column if not exists raw_payload jsonb;

-- Idempotency: avoid duplicates when a provider retries delivery.
-- A lead is uniquely identified by (external_source, external_id) when both are set.
create unique index if not exists leads_external_uniq_idx
  on public.leads (external_source, external_id)
  where external_id is not null and external_source is not null;

-- Quick lookups by campaign for dashboards.
create index if not exists leads_utm_campaign_idx
  on public.leads (utm_campaign)
  where deleted_at is null and utm_campaign is not null;

create index if not exists leads_external_source_idx
  on public.leads (external_source)
  where deleted_at is null and external_source is not null;
