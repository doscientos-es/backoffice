-- Allow MCP work-hour reports without a project filter.
-- A project/lead filter remains optional when a member or date range is supplied.
create or replace function public.mcp_get_work_hours(
  p_project_id uuid, p_lead_id uuid, p_member_id uuid, p_member_name text, p_from date, p_to date
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid := p_project_id;
  v_member_id uuid := p_member_id;
  v_count integer;
  v_rows jsonb;
  v_total numeric;
  v_cost numeric;
  v_by_member jsonb;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if v_project_id is null and p_lead_id is not null then
    select count(*) into v_count
    from public.projects p
    join public.clients c on c.id = p.client_id
    where c.lead_id = p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled';
    if v_count <> 1 then
      return jsonb_build_object(
        'status', 'needs_project_selection',
        'projects', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status) order by p.updated_at desc)
          from public.projects p join public.clients c on c.id = p.client_id
          where c.lead_id = p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled'), '[]'::jsonb));
    end if;
    select p.id into v_project_id
    from public.projects p join public.clients c on c.id = p.client_id
    where c.lead_id = p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled'
    limit 1;
  end if;
  if v_member_id is null and p_member_name is not null then
    select id into v_member_id from public.team_members where deleted_at is null and lower(name) = lower(btrim(p_member_name)) limit 1;
  end if;
  select coalesce(sum(w.hours), 0), coalesce(sum(w.hours * coalesce(m.internal_hourly_cost, s.internal_hourly_cost, 0)), 0),
    coalesce(jsonb_agg(jsonb_build_object('memberId', w.member_id, 'memberName', m.name, 'hours', w.hours, 'hourlyCost', coalesce(m.internal_hourly_cost, s.internal_hourly_cost, 0), 'workDate', w.work_date, 'note', w.note) order by w.work_date desc), '[]'::jsonb)
    into v_total, v_cost, v_rows
    from public.work_logs w join public.team_members m on m.id = w.member_id cross join public.settings s
    where (v_project_id is null or w.project_id = v_project_id) and w.deleted_at is null
      and (v_member_id is null or w.member_id = v_member_id)
      and (p_from is null or w.work_date >= p_from) and (p_to is null or w.work_date <= p_to);
  select coalesce(jsonb_agg(jsonb_build_object('memberId', x.member_id, 'memberName', x.name, 'hours', x.hours, 'hourlyCost', x.hourly_cost, 'laborCost', x.labor_cost) order by x.name), '[]'::jsonb)
    into v_by_member
    from (select w.member_id, m.name, sum(w.hours) hours, coalesce(m.internal_hourly_cost, s.internal_hourly_cost, 0) hourly_cost,
      sum(w.hours) * coalesce(m.internal_hourly_cost, s.internal_hourly_cost, 0) labor_cost
      from public.work_logs w join public.team_members m on m.id = w.member_id cross join public.settings s
      where (v_project_id is null or w.project_id = v_project_id) and w.deleted_at is null
        and (v_member_id is null or w.member_id = v_member_id)
        and (p_from is null or w.work_date >= p_from) and (p_to is null or w.work_date <= p_to)
      group by w.member_id, m.name, m.internal_hourly_cost, s.internal_hourly_cost) x;
  return jsonb_build_object('status', 'ok', 'projectId', v_project_id, 'totalHours', v_total, 'laborCost', round(v_cost, 2), 'byMember', v_by_member, 'entries', v_rows);
end;
$$;

revoke all on function public.mcp_get_work_hours(uuid, uuid, uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.mcp_get_work_hours(uuid, uuid, uuid, text, date, date) to anon, authenticated;
notify pgrst, 'reload schema';
