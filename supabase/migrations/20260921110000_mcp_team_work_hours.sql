-- Team-aware MCP work logging and read model.
-- Existing work_logs remain the source of truth; duplicate same-day entries are
-- reported and skipped instead of silently inflating project cost.
alter table public.team_members add column if not exists internal_hourly_cost numeric(10,2);
alter table public.team_members drop constraint if exists team_members_internal_hourly_cost_check;
alter table public.team_members add constraint team_members_internal_hourly_cost_check check (internal_hourly_cost is null or internal_hourly_cost >= 0);
create or replace function public.mcp_log_team_work_hours(
  p_project_id uuid,
  p_lead_id uuid,
  p_work_date date,
  p_entries jsonb,
  p_note text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_project_id uuid := p_project_id; v_count integer; v_entry jsonb; v_member_id uuid; v_member_name text; v_hours numeric; v_log public.work_logs%rowtype; v_added jsonb := '[]'::jsonb; v_conflicts jsonb := '[]'::jsonb; v_members jsonb := '[]'::jsonb;
begin
  if not public.has_valid_mcp_access_token() then raise exception 'Invalid MCP access token' using errcode = '42501'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 1 or jsonb_array_length(p_entries) > 20 then raise exception 'Provide 1 to 20 people'; end if;
  if v_project_id is null and p_lead_id is null then raise exception 'Provide projectId or leadId'; end if;
  if v_project_id is null then
    select count(*) into v_count from public.projects p join public.clients c on c.id = p.client_id where c.lead_id = p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled';
    if v_count <> 1 then
      return jsonb_build_object('status','needs_project_selection','projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'status',p.status) order by p.updated_at desc) from public.projects p join public.clients c on c.id=p.client_id where c.lead_id=p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled'),'[]'::jsonb));
    end if;
    select p.id into v_project_id from public.projects p join public.clients c on c.id=p.client_id where c.lead_id=p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled' limit 1;
  end if;
  if not exists (select 1 from public.projects where id=v_project_id and deleted_at is null and status <> 'cancelled') then raise exception 'Project not found or cancelled'; end if;
  for v_entry in select * from jsonb_array_elements(p_entries) loop
    v_hours := (v_entry->>'hours')::numeric;
    if v_hours is null or v_hours <= 0 or v_hours > 24 then raise exception 'Each hours value must be greater than 0 and at most 24'; end if;
    v_member_id := nullif(v_entry->>'memberId','')::uuid;
    v_member_name := nullif(btrim(v_entry->>'memberName'),'');
    if v_member_id is null and v_member_name is not null then
      select count(*) into v_count from public.team_members where deleted_at is null and lower(name)=lower(v_member_name);
      if v_count > 1 then
        return jsonb_build_object('status','needs_member_selection','members',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role) order by name) from public.team_members where deleted_at is null and lower(name)=lower(v_member_name)),'[]'::jsonb));
      end if;
      select id into v_member_id from public.team_members where deleted_at is null and lower(name)=lower(v_member_name) limit 1;
    end if;
    if v_member_id is null then
      return jsonb_build_object('status','needs_member_selection','members',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role) order by name) from public.team_members where deleted_at is null),'[]'::jsonb));
    end if;
    if not exists (select 1 from public.team_members where id=v_member_id and deleted_at is null) then raise exception 'Team member not found'; end if;
    if exists (select 1 from public.work_logs where project_id=v_project_id and member_id=v_member_id and work_date=coalesce(p_work_date,current_date) and deleted_at is null) then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('memberId',v_member_id,'memberName',(select name from public.team_members where id=v_member_id),'hoursRequested',v_hours,'reason','already_has_hours_for_project_and_date'));
    else
      insert into public.work_logs(project_id,member_id,work_date,hours,note) values(v_project_id,v_member_id,coalesce(p_work_date,current_date),round(v_hours,2),nullif(btrim(p_note),'')) returning * into v_log;
      v_added := v_added || jsonb_build_array(jsonb_build_object('id',v_log.id,'memberId',v_member_id,'memberName',(select name from public.team_members where id=v_member_id),'hours',v_log.hours,'workDate',v_log.work_date));
    end if;
  end loop;
  insert into public.activity_log(entity_type,entity_id,action,details) values('project',v_project_id,'mcp.team_work_hours_logged',jsonb_build_object('added',v_added,'conflicts',v_conflicts));
  return jsonb_build_object('status',case when jsonb_array_length(v_conflicts)>0 then 'logged_with_conflicts' else 'logged' end,'projectId',v_project_id,'added',v_added,'conflicts',v_conflicts);
end;
$$;

create or replace function public.mcp_get_work_hours(
  p_project_id uuid, p_lead_id uuid, p_member_id uuid, p_member_name text, p_from date, p_to date
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_project_id uuid := p_project_id; v_member_id uuid := p_member_id; v_count integer; v_rows jsonb; v_total numeric; v_cost numeric; v_by_member jsonb;
begin
  if not public.has_valid_mcp_access_token() then raise exception 'Invalid MCP access token' using errcode = '42501'; end if;
  if v_project_id is null and p_lead_id is not null then
    select count(*) into v_count from public.projects p join public.clients c on c.id=p.client_id where c.lead_id=p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled';
    if v_count <> 1 then return jsonb_build_object('status','needs_project_selection','projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'status',p.status) order by p.updated_at desc) from public.projects p join public.clients c on c.id=p.client_id where c.lead_id=p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled'),'[]'::jsonb)); end if;
    select p.id into v_project_id from public.projects p join public.clients c on c.id=p.client_id where c.lead_id=p_lead_id and p.deleted_at is null and c.deleted_at is null and p.status <> 'cancelled' limit 1;
  end if;
  if v_member_id is null and p_member_name is not null then select id into v_member_id from public.team_members where deleted_at is null and lower(name)=lower(btrim(p_member_name)) limit 1; end if;
  select coalesce(sum(w.hours),0), coalesce(sum(w.hours * coalesce(m.internal_hourly_cost,s.internal_hourly_cost,0)),0), coalesce(jsonb_agg(jsonb_build_object('memberId',w.member_id,'memberName',m.name,'hours',w.hours,'hourlyCost',coalesce(m.internal_hourly_cost,s.internal_hourly_cost,0),'workDate',w.work_date,'note',w.note) order by w.work_date desc), '[]'::jsonb)
    into v_total,v_cost,v_rows from public.work_logs w join public.team_members m on m.id=w.member_id cross join public.settings s where w.project_id=v_project_id and w.deleted_at is null and (v_member_id is null or w.member_id=v_member_id) and (p_from is null or w.work_date>=p_from) and (p_to is null or w.work_date<=p_to);
  select coalesce(jsonb_agg(jsonb_build_object('memberId',x.member_id,'memberName',x.name,'hours',x.hours,'hourlyCost',x.hourly_cost,'laborCost',x.labor_cost) order by x.name),'[]'::jsonb) into v_by_member from (select w.member_id,m.name,sum(w.hours) hours,coalesce(m.internal_hourly_cost,s.internal_hourly_cost,0) hourly_cost,sum(w.hours)*coalesce(m.internal_hourly_cost,s.internal_hourly_cost,0) labor_cost from public.work_logs w join public.team_members m on m.id=w.member_id cross join public.settings s where w.project_id=v_project_id and w.deleted_at is null and (p_from is null or w.work_date>=p_from) and (p_to is null or w.work_date<=p_to) group by w.member_id,m.name,m.internal_hourly_cost,s.internal_hourly_cost) x;
  return jsonb_build_object('status','ok','projectId',v_project_id,'totalHours',v_total,'laborCost',round(v_cost,2),'byMember',v_by_member,'entries',v_rows);
end;
$$;

revoke all on function public.mcp_log_team_work_hours(uuid,uuid,date,jsonb,text) from public,anon,authenticated;
revoke all on function public.mcp_get_work_hours(uuid,uuid,uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.mcp_log_team_work_hours(uuid,uuid,date,jsonb,text) to anon,authenticated;
grant execute on function public.mcp_get_work_hours(uuid,uuid,uuid,text,date,date) to anon,authenticated;
notify pgrst, 'reload schema';
