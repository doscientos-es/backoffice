create table if not exists public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  email citext,
  phone text,
  role text,
  company text,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'meet')),
  source_interaction_id uuid references public.lead_interactions(id) on delete set null,
  created_by uuid references public.team_members(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists lead_contacts_lead_idx
  on public.lead_contacts (lead_id, created_at desc)
  where deleted_at is null;
create unique index if not exists lead_contacts_lead_email_uidx
  on public.lead_contacts (lead_id, lower(email::text))
  where deleted_at is null and email is not null;

alter table public.lead_contacts enable row level security;
grant select, insert, update, delete on public.lead_contacts to authenticated;

create policy lead_contacts_select on public.lead_contacts
  for select using (public.can_access_lead(lead_id));
create policy lead_contacts_insert on public.lead_contacts
  for insert with check (public.can_access_lead(lead_id) and public.has_permission('leads.write'));
create policy lead_contacts_update on public.lead_contacts
  for update using (public.can_access_lead(lead_id) and public.has_permission('leads.write'))
  with check (public.can_access_lead(lead_id) and public.has_permission('leads.write'));
create policy lead_contacts_delete on public.lead_contacts
  for delete using (public.can_access_lead(lead_id) and public.has_permission('leads.write'));

create trigger trg_touch_lead_contacts before update on public.lead_contacts
  for each row execute function public.fn_touch_updated_at();
