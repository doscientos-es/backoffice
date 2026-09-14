-- Durable cross-device call tracking. A session represents an attempted call;
-- the commercial interaction is still created only when the rep confirms it.

create table if not exists public.lead_call_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  initiated_by uuid not null references public.team_members(id) on delete cascade,
  mobile_token uuid not null default gen_random_uuid() unique,
  source text not null check (source in ('desktop', 'qr', 'mobile')),
  status text not null default 'started'
    check (status in ('started', 'dialing', 'awaiting_log', 'logged', 'abandoned')),
  started_at timestamptz not null default now(),
  dialed_at timestamptz,
  finished_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  expires_at timestamptz not null default (now() + interval '4 hours')
);

create index if not exists lead_call_sessions_member_active_idx
  on public.lead_call_sessions(initiated_by, started_at desc)
  where status in ('started', 'dialing', 'awaiting_log');

alter table public.lead_call_sessions enable row level security;

create policy lead_call_sessions_select on public.lead_call_sessions
  for select using (
    public.is_team_member()
    and (initiated_by = auth.uid() or public.current_member_role() in ('owner', 'admin'))
  );
create policy lead_call_sessions_insert on public.lead_call_sessions
  for insert with check (public.is_team_member() and initiated_by = auth.uid());
create policy lead_call_sessions_update on public.lead_call_sessions
  for update using (initiated_by = auth.uid()) with check (initiated_by = auth.uid());

drop trigger if exists trg_audit_lead_call_sessions on public.lead_call_sessions;
create trigger trg_audit_lead_call_sessions
  after insert or update or delete on public.lead_call_sessions
  for each row execute function public.audit_row_change();

comment on table public.lead_call_sessions is
  'Short-lived, traceable call attempts that bridge desktop context and a personal mobile dialer.';

notify pgrst, 'reload schema';