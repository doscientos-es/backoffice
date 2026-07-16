-- Feature: Social Hub — audit trail for every Meta comment webhook event.

create table if not exists public.social_automation_events (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null check (platform in ('instagram', 'facebook')),
  source_id          text not null,
  remote_post_id     text not null,
  remote_comment_id  text not null,
  target_id          uuid references public.social_post_targets(id) on delete set null,
  post_id            uuid references public.social_posts(id) on delete set null,
  rule_id            uuid references public.social_automation_rules(id) on delete set null,
  run_id             uuid references public.social_automation_runs(id) on delete set null,
  author_id          text,
  author_name        text not null default '',
  comment_text       text not null default '',
  outcome            text not null default 'received'
                       check (outcome in (
                         'received',
                         'ignored_self',
                         'ignored_no_target',
                         'ignored_no_rule',
                         'matched',
                         'completed',
                         'failed'
                       )),
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (platform, remote_comment_id)
);

create index if not exists social_automation_events_activity_idx
  on public.social_automation_events(created_at desc);

create index if not exists social_automation_events_outcome_idx
  on public.social_automation_events(outcome, created_at desc);

alter table public.social_automation_events enable row level security;

drop policy if exists social_automation_events_select on public.social_automation_events;
create policy social_automation_events_select on public.social_automation_events
  for select using (public.is_team_member());

drop trigger if exists trg_touch_social_automation_events on public.social_automation_events;
create trigger trg_touch_social_automation_events
  before update on public.social_automation_events
  for each row execute function public.fn_touch_updated_at();