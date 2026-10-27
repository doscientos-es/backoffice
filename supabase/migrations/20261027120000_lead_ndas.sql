-- NDAs generated per lead. The text is a fixed template in code; each row only
-- stores the counterparty data snapshot, a public token and the signature.
-- Public access (/p/nda/[token]) goes through the service role, never through RLS.

create table if not exists public.lead_ndas (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid not null references public.leads(id) on delete cascade,
  portal_token         text not null unique default encode(gen_random_bytes(24), 'hex'),
  counterparty_name    text not null,
  counterparty_nif     text,
  counterparty_address text,
  representative_name  text,
  purpose              text not null,
  confidentiality_years integer not null default 3 check (confidentiality_years between 1 and 10),
  effective_date       date not null default current_date,
  status               text not null default 'pending' check (status in ('pending', 'signed', 'void')),
  signed_at            timestamptz,
  signed_name          text,
  signed_ip            text,
  created_by           uuid references public.team_members(id) on delete set null,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index if not exists lead_ndas_lead_idx
  on public.lead_ndas(lead_id, created_at desc)
  where deleted_at is null;

alter table public.lead_ndas enable row level security;

drop policy if exists lead_ndas_select on public.lead_ndas;
create policy lead_ndas_select on public.lead_ndas
  for select using (public.is_team_member());

drop policy if exists lead_ndas_insert on public.lead_ndas;
create policy lead_ndas_insert on public.lead_ndas
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists lead_ndas_update on public.lead_ndas;
create policy lead_ndas_update on public.lead_ndas
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

notify pgrst, 'reload schema';
