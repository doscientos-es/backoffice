-- Existing lead detail and proposal flows expect at most one active billing
-- record per lead. Archived records and clients without a lead are preserved.
create unique index clients_active_lead_id_unique
  on public.clients (lead_id)
  where lead_id is not null and deleted_at is null;