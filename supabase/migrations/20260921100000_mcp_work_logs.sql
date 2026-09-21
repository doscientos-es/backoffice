-- Manual hour logging from the internal MCP.
-- The project is optional when a lead has exactly one non-deleted project;
-- otherwise the RPC returns the candidate projects so the caller can ask.
create or replace function public.mcp_log_work_hours(
  p_project_id uuid,
  p_lead_id uuid,
  p_member_id uuid,
  p_work_date date,
  p_hours numeric,
  p_note text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_project_id uuid := p_project_id; v_member_id uuid := p_member_id; v_count integer; v_log public.work_logs%rowtype;
begin
  if not public.has_valid_mcp_access_token() then raise exception 'Invalid MCP access token' using errcode = '42501'; end if;
  if p_hours is null or p_hours <= 0 or p_hours > 24 then raise exception 'Hours must be greater than 0 and at most 24'; end if;
  if v_project_id is null and p_lead_id is null then raise exception 'Provide projectId or leadId'; end if;
  if v_project_id is null then
    select count(*) into v_count
    from public.projects p join public.clients c on c.id = p.client_id
    where c.lead_id = p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status not in ('cancelled');
    if v_count <> 1 then
      return jsonb_build_object('status', 'needs_project_selection', 'projects', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status) order by p.updated_at desc)
        from public.projects p join public.clients c on c.id = p.client_id
        where c.lead_id = p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status not in ('cancelled')
      ), '[]'::jsonb));
    end if;
    select p.id into v_project_id
    from public.projects p join public.clients c on c.id = p.client_id
    where c.lead_id = p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status not in ('cancelled')
    limit 1;
  end if;
  if not exists (select 1 from public.projects where id = v_project_id and deleted_at is null and status <> 'cancelled') then raise exception 'Project not found or cancelled'; end if;
  if v_member_id is null then select id into v_member_id from public.team_members where deleted_at is null and role in ('owner','admin') order by role, created_at limit 1; end if;
  if v_member_id is null or not exists (select 1 from public.team_members where id = v_member_id and deleted_at is null) then raise exception 'No active team member available for the work log'; end if;
  insert into public.work_logs(project_id, member_id, work_date, hours, note)
  values (v_project_id, v_member_id, coalesce(p_work_date, current_date), round(p_hours, 2), nullif(btrim(p_note), ''))
  returning * into v_log;
  insert into public.activity_log(entity_type, entity_id, action, details)
  values ('project', v_project_id, 'mcp.work_hours_logged', jsonb_build_object('work_log_id', v_log.id, 'hours', v_log.hours, 'work_date', v_log.work_date));
  return jsonb_build_object('status', 'logged', 'id', v_log.id, 'projectId', v_project_id, 'memberId', v_member_id, 'workDate', v_log.work_date, 'hours', v_log.hours, 'note', v_log.note);
end;
$$;

revoke all on function public.mcp_log_work_hours(uuid, uuid, uuid, date, numeric, text) from public, anon, authenticated;
grant execute on function public.mcp_log_work_hours(uuid, uuid, uuid, date, numeric, text) to anon, authenticated;
notify pgrst, 'reload schema';
