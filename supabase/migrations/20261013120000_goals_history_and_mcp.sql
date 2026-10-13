-- Goals v2: monthly target history, a shared monthly summary function and
-- token-gated MCP access. The summary function is the single source of truth
-- for "actual" values, used by both the backoffice and the MCP.

alter type public.goal_metric add value if not exists 'proposals_sent';

-- ---------------------------------------------------------------------------
-- Target history: which target was in force each month. Maintained by trigger,
-- so past months keep the target they were judged against.
-- ---------------------------------------------------------------------------
create table if not exists public.company_goal_targets (
  metric     public.goal_metric not null,
  month      date not null check (month = date_trunc('month', month)::date),
  target     numeric not null check (target > 0),
  updated_at timestamptz not null default now(),
  primary key (metric, month)
);

alter table public.company_goal_targets enable row level security;
revoke all on table public.company_goal_targets from public, anon, authenticated;
grant select on table public.company_goal_targets to anon, authenticated;

drop policy if exists team_read_goal_targets on public.company_goal_targets;
create policy team_read_goal_targets on public.company_goal_targets
  for select to authenticated using (public.is_team_member());

drop policy if exists mcp_reader_select on public.company_goal_targets;
create policy mcp_reader_select on public.company_goal_targets
  for select to anon, authenticated using (public.has_valid_mcp_access_token());

-- The MCP reads current goals too (writes stay behind the RPCs below).
grant select on table public.company_goals to anon;
drop policy if exists mcp_reader_select on public.company_goals;
create policy mcp_reader_select on public.company_goals
  for select to anon, authenticated using (public.has_valid_mcp_access_token());

create or replace function public.sync_company_goal_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Europe/Madrid')::date;
begin
  if tg_op = 'DELETE' then
    delete from public.company_goal_targets
    where metric = old.metric and month = v_month;
    return old;
  end if;
  insert into public.company_goal_targets (metric, month, target, updated_at)
  values (new.metric, v_month, new.target, now())
  on conflict (metric, month)
  do update set target = excluded.target, updated_at = now();
  return new;
end;
$$;

drop trigger if exists company_goals_sync_target on public.company_goals;
create trigger company_goals_sync_target
  after insert or update of target or delete on public.company_goals
  for each row execute function public.sync_company_goal_target();

-- Backfill the current month with the goals already configured.
insert into public.company_goal_targets (metric, month, target)
select metric, date_trunc('month', now() at time zone 'Europe/Madrid')::date, target
from public.company_goals
on conflict (metric, month) do nothing;

-- ---------------------------------------------------------------------------
-- Monthly summary: one row per metric with the target in force and the actual.
-- SECURITY INVOKER: RLS of the caller applies (team member or MCP token).
-- Definitions mirror the dashboard: revenue = issued/paid/overdue invoices by
-- issue date; conversion = won / all leads created in the month.
-- ---------------------------------------------------------------------------
create or replace function public.goal_month_summary(p_month date)
returns table (metric text, target numeric, actual numeric)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as s,
           (date_trunc('month', p_month) + interval '1 month')::date as e
  ),
  leads_m as (
    select count(*)::numeric as total,
           count(*) filter (where l.status = 'won')::numeric as won
    from public.leads l, bounds b
    where l.deleted_at is null
      and (l.created_at at time zone 'Europe/Madrid')::date >= b.s
      and (l.created_at at time zone 'Europe/Madrid')::date < b.e
  ),
  revenue_m as (
    select coalesce(sum(i.total), 0)::numeric as total
    from public.invoices i, bounds b
    where i.deleted_at is null
      and i.status in ('issued', 'paid', 'overdue')
      and i.issue_date >= b.s and i.issue_date < b.e
  ),
  proposals_m as (
    select count(*)::numeric as n
    from public.proposals p, bounds b
    where p.deleted_at is null and p.sent_at is not null
      and (p.sent_at at time zone 'Europe/Madrid')::date >= b.s
      and (p.sent_at at time zone 'Europe/Madrid')::date < b.e
  ),
  actuals (metric, actual) as (
    select 'leads_new', total from leads_m
    union all select 'revenue', total from revenue_m
    union all select 'conversion_rate',
      case when total > 0 then won / total else 0 end from leads_m
    union all select 'proposals_sent', n from proposals_m
  )
  select a.metric, t.target, a.actual
  from actuals a
  cross join bounds b
  left join public.company_goal_targets t
    on t.metric::text = a.metric and t.month = b.s;
$$;

revoke all on function public.goal_month_summary(date) from public, anon, authenticated;
grant execute on function public.goal_month_summary(date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- MCP write RPCs (token-gated, audited in activity_log)
-- ---------------------------------------------------------------------------
create or replace function public.mcp_upsert_company_goal(p_metric text, p_target numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous numeric;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if p_metric not in ('leads_new', 'revenue', 'conversion_rate', 'proposals_sent') then
    raise exception 'Unknown goal metric';
  end if;
  if p_target is null or p_target <= 0 then
    raise exception 'Goal target must be greater than 0';
  end if;
  if p_metric = 'conversion_rate' and p_target > 1 then
    raise exception 'conversion_rate target is a fraction between 0 and 1';
  end if;
  if p_metric <> 'conversion_rate' and p_target > 100000000 then
    raise exception 'Goal target is too large';
  end if;

  select target into v_previous from public.company_goals where metric = p_metric::public.goal_metric;

  insert into public.company_goals (metric, target)
  values (p_metric::public.goal_metric, p_target)
  on conflict (metric) do update set target = excluded.target, updated_at = now();

  insert into public.activity_log (entity_type, entity_id, action, details)
  values ('company_goal', null, 'mcp.goal_set',
    jsonb_build_object('metric', p_metric, 'target', p_target, 'previous', v_previous));

  return jsonb_build_object('metric', p_metric, 'target', p_target, 'previousTarget', v_previous);
end;
$$;

create or replace function public.mcp_delete_company_goal(p_metric text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if p_metric not in ('leads_new', 'revenue', 'conversion_rate', 'proposals_sent') then
    raise exception 'Unknown goal metric';
  end if;
  delete from public.company_goals where metric = p_metric::public.goal_metric;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    insert into public.activity_log (entity_type, entity_id, action, details)
    values ('company_goal', null, 'mcp.goal_cleared', jsonb_build_object('metric', p_metric));
  end if;
  return jsonb_build_object('metric', p_metric, 'deleted', v_deleted > 0);
end;
$$;

revoke all on function public.mcp_upsert_company_goal(text, numeric) from public, anon, authenticated;
revoke all on function public.mcp_delete_company_goal(text) from public, anon, authenticated;
grant execute on function public.mcp_upsert_company_goal(text, numeric) to anon, authenticated;
grant execute on function public.mcp_delete_company_goal(text) to anon, authenticated;

notify pgrst, 'reload schema';
