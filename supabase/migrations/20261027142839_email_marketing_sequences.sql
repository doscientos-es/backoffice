-- Lists, contacts, and scheduled multi-step email sequences.
-- Existing newsletter_issues and lead_campaign_sends are retained so prior
-- sends and tracking history remain available.

create table if not exists public.email_marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'subscribed'
    check (status in ('subscribed','unsubscribed','bounced','complained')),
  consented_at timestamptz,
  consent_source text,
  consent_reference text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_marketing_contacts
  add constraint email_marketing_contacts_email_key unique (email);
create unique index if not exists email_marketing_contacts_email_lower_uidx
  on public.email_marketing_contacts (lower(email));
create index if not exists email_marketing_contacts_lead_idx
  on public.email_marketing_contacts (lead_id) where lead_id is not null;

create table if not exists public.email_marketing_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.email_marketing_list_members (
  list_id uuid not null references public.email_marketing_lists(id) on delete cascade,
  contact_id uuid not null references public.email_marketing_contacts(id) on delete cascade,
  consented_at timestamptz not null default now(),
  consent_source text,
  consent_reference text,
  created_at timestamptz not null default now(),
  primary key (list_id, contact_id)
);
create index if not exists email_marketing_list_members_contact_idx
  on public.email_marketing_list_members (contact_id);

create table if not exists public.email_marketing_sequences (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.email_marketing_lists(id) on delete restrict,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists email_marketing_sequences_list_idx
  on public.email_marketing_sequences (list_id) where deleted_at is null;

create table if not exists public.email_marketing_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_marketing_sequences(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  subject text not null,
  preview_text text,
  body_markdown text not null,
  scheduled_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','sending','sent','paused','failed')),
  tracking_campaign_id uuid references public.lead_campaigns(id) on delete set null,
  sent_at timestamptz,
  last_error text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_id, position)
);
create index if not exists email_marketing_steps_due_idx
  on public.email_marketing_sequence_steps (scheduled_at)
  where status = 'scheduled';

alter table public.lead_campaign_sends
  add column if not exists marketing_contact_id uuid references public.email_marketing_contacts(id) on delete set null,
  add column if not exists sequence_step_id uuid references public.email_marketing_sequence_steps(id) on delete set null,
  add column if not exists clicked_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists marketing_send_status text not null default 'sent'
    check (marketing_send_status in ('queued','sending','sent','failed','skipped')),
  add column if not exists marketing_send_error text,
  add column if not exists bounced_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists converted_lead_id uuid references public.leads(id) on delete set null;

create index if not exists lead_campaign_sends_marketing_contact_idx
  on public.lead_campaign_sends (marketing_contact_id)
  where marketing_contact_id is not null;

create unique index if not exists lead_campaign_sends_step_contact_uidx
  on public.lead_campaign_sends (sequence_step_id, marketing_contact_id)
  where sequence_step_id is not null and marketing_contact_id is not null;
create index if not exists lead_campaign_sends_marketing_status_idx
  on public.lead_campaign_sends (marketing_send_status, created_at)
  where sequence_step_id is not null;

-- Backfill recipient attribution from captured UTM terms when a lead is created.
create or replace function public.link_email_marketing_conversion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.utm_term is not null then
    update public.lead_campaign_sends
    set converted_lead_id = new.id
    where tracking_token::text = new.utm_term
      and converted_lead_id is null;
  end if;
  return new;
end;
$$;
revoke all on function public.link_email_marketing_conversion() from public, anon, authenticated;
drop trigger if exists trg_link_email_marketing_conversion on public.leads;
create trigger trg_link_email_marketing_conversion
  after insert or update of utm_term on public.leads
  for each row execute function public.link_email_marketing_conversion();

alter table public.email_marketing_contacts enable row level security;
alter table public.email_marketing_lists enable row level security;
alter table public.email_marketing_list_members enable row level security;
alter table public.email_marketing_sequences enable row level security;
alter table public.email_marketing_sequence_steps enable row level security;

drop policy if exists email_marketing_contacts_select on public.email_marketing_contacts;
create policy email_marketing_contacts_select on public.email_marketing_contacts
  for select using (public.is_team_member());
drop policy if exists email_marketing_contacts_insert on public.email_marketing_contacts;
create policy email_marketing_contacts_insert on public.email_marketing_contacts
  for insert with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_contacts_update on public.email_marketing_contacts;
create policy email_marketing_contacts_update on public.email_marketing_contacts
  for update using (public.current_member_role() in ('owner','admin','member'))
  with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_contacts_delete on public.email_marketing_contacts;
create policy email_marketing_contacts_delete on public.email_marketing_contacts
  for delete using (public.current_member_role() in ('owner','admin'));

drop policy if exists email_marketing_lists_select on public.email_marketing_lists;
create policy email_marketing_lists_select on public.email_marketing_lists
  for select using (public.is_team_member());
drop policy if exists email_marketing_lists_insert on public.email_marketing_lists;
create policy email_marketing_lists_insert on public.email_marketing_lists
  for insert with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_lists_update on public.email_marketing_lists;
create policy email_marketing_lists_update on public.email_marketing_lists
  for update using (public.current_member_role() in ('owner','admin','member'))
  with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_lists_delete on public.email_marketing_lists;
create policy email_marketing_lists_delete on public.email_marketing_lists
  for delete using (public.current_member_role() in ('owner','admin'));

drop policy if exists email_marketing_list_members_select on public.email_marketing_list_members;
create policy email_marketing_list_members_select on public.email_marketing_list_members
  for select using (public.is_team_member());
drop policy if exists email_marketing_list_members_insert on public.email_marketing_list_members;
create policy email_marketing_list_members_insert on public.email_marketing_list_members
  for insert with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_list_members_delete on public.email_marketing_list_members;
create policy email_marketing_list_members_delete on public.email_marketing_list_members
  for delete using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists email_marketing_sequences_select on public.email_marketing_sequences;
create policy email_marketing_sequences_select on public.email_marketing_sequences
  for select using (public.is_team_member());
drop policy if exists email_marketing_sequences_insert on public.email_marketing_sequences;
create policy email_marketing_sequences_insert on public.email_marketing_sequences
  for insert with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_sequences_update on public.email_marketing_sequences;
create policy email_marketing_sequences_update on public.email_marketing_sequences
  for update using (public.current_member_role() in ('owner','admin','member'))
  with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_sequences_delete on public.email_marketing_sequences;
create policy email_marketing_sequences_delete on public.email_marketing_sequences
  for delete using (public.current_member_role() in ('owner','admin'));

drop policy if exists email_marketing_steps_select on public.email_marketing_sequence_steps;
create policy email_marketing_steps_select on public.email_marketing_sequence_steps
  for select using (public.is_team_member());
drop policy if exists email_marketing_steps_insert on public.email_marketing_sequence_steps;
create policy email_marketing_steps_insert on public.email_marketing_sequence_steps
  for insert with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_steps_update on public.email_marketing_sequence_steps;
create policy email_marketing_steps_update on public.email_marketing_sequence_steps
  for update using (public.current_member_role() in ('owner','admin','member'))
  with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists email_marketing_steps_delete on public.email_marketing_sequence_steps;
create policy email_marketing_steps_delete on public.email_marketing_sequence_steps
  for delete using (public.current_member_role() in ('owner','admin'));

drop trigger if exists trg_touch_email_marketing_contacts on public.email_marketing_contacts;
create trigger trg_touch_email_marketing_contacts before update on public.email_marketing_contacts
  for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_email_marketing_lists on public.email_marketing_lists;
create trigger trg_touch_email_marketing_lists before update on public.email_marketing_lists
  for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_email_marketing_sequences on public.email_marketing_sequences;
create trigger trg_touch_email_marketing_sequences before update on public.email_marketing_sequences
  for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_email_marketing_steps on public.email_marketing_sequence_steps;
create trigger trg_touch_email_marketing_steps before update on public.email_marketing_sequence_steps
  for each row execute function public.fn_touch_updated_at();
