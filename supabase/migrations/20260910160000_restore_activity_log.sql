-- Restore the central business audit table on databases where the historical
-- cleanup migration had already removed it before later portal/MCP migrations
-- started writing events. This is deliberately idempotent and forward-only.

create table if not exists public.activity_log (
  id bigserial primary key,
  actor_id uuid references public.team_members(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_entity_idx
  on public.activity_log(entity_type, entity_id, created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select using (public.is_team_member());

comment on table public.activity_log is
  'Append-only business audit events written by trusted server-side workflows.';