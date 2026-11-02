create table if not exists public.lead_contact_suggestion_dismissals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  suggestion_key text not null check (char_length(suggestion_key) between 1 and 320),
  name text not null check (char_length(trim(name)) between 1 and 160),
  email citext,
  phone text,
  dismissed_by uuid references public.team_members(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  unique (lead_id, suggestion_key)
);

create index if not exists lead_contact_suggestion_dismissals_lead_idx
  on public.lead_contact_suggestion_dismissals (lead_id, dismissed_at desc);

alter table public.lead_contact_suggestion_dismissals enable row level security;
revoke all on public.lead_contact_suggestion_dismissals from anon, authenticated;
grant select, insert on public.lead_contact_suggestion_dismissals to authenticated;

create policy lead_contact_suggestion_dismissals_select
  on public.lead_contact_suggestion_dismissals
  for select using (public.can_access_lead(lead_id));

create policy lead_contact_suggestion_dismissals_insert
  on public.lead_contact_suggestion_dismissals
  for insert with check (
    public.can_access_lead(lead_id)
    and public.has_permission('leads.write')
    and (dismissed_by is null or dismissed_by = (select auth.uid()))
  );
