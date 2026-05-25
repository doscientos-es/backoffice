-- ============================================================
-- Helpers + RLS policies
-- ============================================================

create or replace function public.current_member_role()
returns member_role
language sql stable security definer set search_path = public
as $$
  select role from public.team_members
  where id = auth.uid() and deleted_at is null
  limit 1
$$;

create or replace function public.is_team_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where id = auth.uid() and deleted_at is null
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.team_members (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'member')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ENABLE RLS ----------
alter table public.team_members      enable row level security;
alter table public.settings          enable row level security;
alter table public.leads             enable row level security;
alter table public.clients           enable row level security;
alter table public.projects          enable row level security;
alter table public.proposals         enable row level security;
alter table public.proposal_items    enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_items     enable row level security;
alter table public.tasks             enable row level security;
alter table public.reminders         enable row level security;
alter table public.documents         enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.email_templates   enable row level security;
alter table public.activity_log      enable row level security;

-- ---------- POLICIES ----------
-- All team members can read everything; mutations require >= 'member'.
-- Viewers are read-only. Owner/Admin can manage members and settings.

do $$
declare t text;
begin
  foreach t in array array[
    'leads','clients','projects','proposals','proposal_items',
    'invoices','invoice_items','tasks','reminders','documents',
    'lead_interactions','email_templates','activity_log'
  ] loop
    execute format('drop policy if exists "%s_select" on public.%s', t, t);
    execute format('create policy "%s_select" on public.%s for select using (public.is_team_member())', t, t);

    execute format('drop policy if exists "%s_insert" on public.%s', t, t);
    execute format('create policy "%s_insert" on public.%s for insert with check (public.current_member_role() in (''owner'',''admin'',''member''))', t, t);

    execute format('drop policy if exists "%s_update" on public.%s', t, t);
    execute format('create policy "%s_update" on public.%s for update using (public.current_member_role() in (''owner'',''admin'',''member''))', t, t);

    execute format('drop policy if exists "%s_delete" on public.%s', t, t);
    execute format('create policy "%s_delete" on public.%s for delete using (public.current_member_role() in (''owner'',''admin''))', t, t);
  end loop;
end $$;

-- team_members: read self + everyone if team member; only owner/admin manage
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (public.is_team_member());

drop policy if exists team_members_update_self on public.team_members;
create policy team_members_update_self on public.team_members
  for update using (id = auth.uid());

drop policy if exists team_members_update_admin on public.team_members;
create policy team_members_update_admin on public.team_members
  for update using (public.current_member_role() in ('owner','admin'));

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
  for insert with check (public.current_member_role() in ('owner','admin'));

-- settings
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select using (public.is_team_member());

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update using (public.current_member_role() in ('owner','admin'));

-- updated_at autoupdate
create or replace function public.fn_touch_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'team_members','settings','leads','clients','projects',
    'proposals','invoices','tasks','email_templates'
  ] loop
    execute format('drop trigger if exists trg_touch_%s on public.%s', t, t);
    execute format('create trigger trg_touch_%s before update on public.%s for each row execute function public.fn_touch_updated_at()', t, t);
  end loop;
end $$;
