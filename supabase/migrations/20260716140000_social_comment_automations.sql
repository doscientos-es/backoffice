-- Feature: Social Hub — keyword-triggered Meta comment automations.
-- Rules are scoped to a post or global (post_id NULL). A post-scoped rule wins.

create table if not exists public.social_automation_rules (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid references public.social_posts(id) on delete cascade,
  platform          text not null check (platform in ('instagram', 'facebook')),
  keyword           text not null check (length(btrim(keyword)) > 0),
  keyword_normalized text not null check (length(keyword_normalized) > 0),
  public_reply      text not null check (length(btrim(public_reply)) > 0),
  private_message   text not null check (length(btrim(private_message)) > 0),
  active            boolean not null default true,
  created_by        uuid references public.team_members(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists social_automation_rules_scope_key
  on public.social_automation_rules (
    coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid),
    platform,
    keyword_normalized
  );

create index if not exists social_automation_rules_lookup_idx
  on public.social_automation_rules(post_id, platform, active);

create table if not exists public.social_automation_runs (
  id                 uuid primary key default gen_random_uuid(),
  rule_id            uuid not null references public.social_automation_rules(id) on delete cascade,
  target_id          uuid not null references public.social_post_targets(id) on delete cascade,
  platform           text not null check (platform in ('instagram', 'facebook')),
  remote_comment_id  text not null,
  private_status     text not null default 'pending'
                       check (private_status in ('pending', 'sending', 'sent', 'failed')),
  public_status      text not null default 'pending'
                       check (public_status in ('pending', 'sending', 'sent', 'failed')),
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (rule_id, platform, remote_comment_id)
);

create index if not exists social_automation_runs_failed_idx
  on public.social_automation_runs(updated_at desc)
  where private_status = 'failed' or public_status = 'failed';

alter table public.social_automation_rules enable row level security;
alter table public.social_automation_runs enable row level security;

drop policy if exists social_automation_rules_select on public.social_automation_rules;
create policy social_automation_rules_select on public.social_automation_rules
  for select using (public.is_team_member());

drop policy if exists social_automation_rules_insert on public.social_automation_rules;
create policy social_automation_rules_insert on public.social_automation_rules
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists social_automation_rules_update on public.social_automation_rules;
create policy social_automation_rules_update on public.social_automation_rules
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists social_automation_rules_delete on public.social_automation_rules;
create policy social_automation_rules_delete on public.social_automation_rules
  for delete using (public.current_member_role() in ('owner', 'admin'));

drop policy if exists social_automation_runs_select on public.social_automation_runs;
create policy social_automation_runs_select on public.social_automation_runs
  for select using (public.is_team_member());

drop trigger if exists trg_touch_social_automation_rules on public.social_automation_rules;
create trigger trg_touch_social_automation_rules
  before update on public.social_automation_rules
  for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_social_automation_runs on public.social_automation_runs;
create trigger trg_touch_social_automation_runs
  before update on public.social_automation_runs
  for each row execute function public.fn_touch_updated_at();