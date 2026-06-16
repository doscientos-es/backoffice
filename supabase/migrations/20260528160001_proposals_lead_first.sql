-- ============================================================
-- Proposals · lead-first flow
-- ------------------------------------------------------------
-- A proposal can target either a known client OR a lead whose
-- company hasn't yet provided fiscal data. Exactly one of
-- (client_id, lead_id) must be non-null.
--
-- The proposal number is also deferred until the proposal is
-- first sent — drafts no longer occupy series numbers. A
-- snapshot of the fiscal data submitted by the lead on the
-- portal at acceptance time is stored on the proposal itself
-- for audit purposes (independent of later edits to clients).
-- ============================================================

-- Add lead_id + accepted fiscal snapshot.
alter table public.proposals
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists accepted_fiscal_data jsonb;

-- Relax client_id and number so drafts can live without either.
alter table public.proposals alter column client_id drop not null;
alter table public.proposals alter column number drop not null;

-- The original DDL defined `number text not null unique` inline, which
-- generates an auto-named UNIQUE constraint. Replace it with a partial
-- unique index that only enforces uniqueness for assigned numbers and
-- ignores soft-deleted rows.
do $$
declare
  cname text;
begin
  select c.conname into cname
    from pg_constraint c
    where c.conrelid = 'public.proposals'::regclass
      and c.contype  = 'u'
      and pg_get_constraintdef(c.oid) ilike '%(number)%'
    limit 1;
  if cname is not null then
    execute format('alter table public.proposals drop constraint %I', cname);
  end if;
end $$;

create unique index if not exists proposals_number_unique_idx
  on public.proposals(number)
  where number is not null and deleted_at is null;

-- Exactly one of (client_id, lead_id) must be set.
do $$ begin
  alter table public.proposals
    add constraint proposals_lead_or_client_chk
    check ((client_id is not null) <> (lead_id is not null));
exception when duplicate_object then null; end $$;

create index if not exists proposals_lead_idx
  on public.proposals(lead_id)
  where deleted_at is null;
