-- Extend the token-gated MCP task RPCs with assignment and planning metadata.
-- The MCP remains restricted to project tasks and validates every referenced ID.

drop function if exists public.mcp_create_project_task(uuid, text, text, text, date, boolean, uuid);
drop function if exists public.mcp_update_project_task(uuid, bigint, text, boolean, text, text, boolean, date, boolean);

create or replace function public.mcp_create_project_task(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_due_date date,
  p_is_client_visible boolean,
  p_assignee_id uuid,
  p_parent_task_id uuid,
  p_estimated_hours numeric,
  p_is_billable boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if length(btrim(p_title)) < 1 or length(p_title) > 200 then
    raise exception 'Task title must contain 1 to 200 characters';
  end if;
  if p_description is not null and length(p_description) > 8000 then
    raise exception 'Task description is too long';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid task priority';
  end if;
  if p_estimated_hours is not null
     and (p_estimated_hours <= 0 or p_estimated_hours > 9999.99) then
    raise exception 'Estimated hours must be between 0 and 9999.99';
  end if;
  if not exists (
    select 1 from public.projects
    where id = p_project_id and deleted_at is null
  ) then
    raise exception 'Project not found';
  end if;
  if p_assignee_id is not null and not exists (
    select 1 from public.team_members
    where id = p_assignee_id and deleted_at is null
  ) then
    raise exception 'Task assignee not found or inactive';
  end if;
  if p_parent_task_id is not null and not exists (
    select 1 from public.tasks
    where id = p_parent_task_id
      and project_id = p_project_id
      and kind = 'task'
      and deleted_at is null
  ) then
    raise exception 'Parent task not found in this project';
  end if;

  if p_idempotency_key is not null then
    select * into v_task
    from public.tasks
    where mcp_idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'id', v_task.id,
        'projectId', v_task.project_id,
        'status', v_task.status,
        'version', v_task.version,
        'assigneeId', v_task.assignee_id,
        'idempotentReplay', true
      );
    end if;
  end if;

  insert into public.tasks (
    project_id, parent_task_id, assignee_id, kind, title, description,
    status, priority, due_date, estimated_hours, is_billable,
    is_client_visible, mcp_idempotency_key, kanban_order
  ) values (
    p_project_id, p_parent_task_id, p_assignee_id, 'task', btrim(p_title),
    nullif(btrim(p_description), ''), 'todo', p_priority, p_due_date,
    p_estimated_hours, coalesce(p_is_billable, true),
    p_is_client_visible, p_idempotency_key, 'm'
  )
  returning * into v_task;

  if p_assignee_id is not null then
    insert into public.task_members(task_id, member_id)
    values (v_task.id, p_assignee_id)
    on conflict (task_id, member_id) do nothing;
  end if;

  insert into public.activity_log(entity_type, entity_id, action, details)
  values (
    'task', v_task.id, 'mcp.created',
    jsonb_build_object(
      'project_id', p_project_id,
      'client_visible', p_is_client_visible,
      'assigned', p_assignee_id is not null
    )
  );

  return jsonb_build_object(
    'id', v_task.id,
    'projectId', v_task.project_id,
    'status', v_task.status,
    'version', v_task.version,
    'assigneeId', v_task.assignee_id,
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.mcp_update_project_task(
  p_task_id uuid,
  p_expected_version bigint,
  p_title text,
  p_set_description boolean,
  p_description text,
  p_priority text,
  p_set_due_date boolean,
  p_due_date date,
  p_is_client_visible boolean,
  p_set_assignee boolean,
  p_assignee_id uuid,
  p_set_parent_task boolean,
  p_parent_task_id uuid,
  p_set_estimated_hours boolean,
  p_estimated_hours numeric,
  p_is_billable boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.tasks%rowtype;
  v_task public.tasks%rowtype;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;

  select * into v_current
  from public.tasks
  where id = p_task_id
    and kind = 'task'
    and project_id is not null
    and deleted_at is null;
  if not found then
    raise exception 'Task not found';
  end if;
  if v_current.version <> p_expected_version then
    raise exception 'Task version conflict; read it again before updating';
  end if;

  if p_title is not null and (length(btrim(p_title)) < 1 or length(p_title) > 200) then
    raise exception 'Task title must contain 1 to 200 characters';
  end if;
  if p_set_description and p_description is not null and length(p_description) > 8000 then
    raise exception 'Task description is too long';
  end if;
  if p_priority is not null and p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid task priority';
  end if;
  if p_set_estimated_hours and p_estimated_hours is not null
     and (p_estimated_hours <= 0 or p_estimated_hours > 9999.99) then
    raise exception 'Estimated hours must be between 0 and 9999.99';
  end if;
  if p_set_assignee and p_assignee_id is not null and not exists (
    select 1 from public.team_members
    where id = p_assignee_id and deleted_at is null
  ) then
    raise exception 'Task assignee not found or inactive';
  end if;

  if p_set_parent_task and p_parent_task_id is not null then
    if p_parent_task_id = p_task_id then
      raise exception 'A task cannot be its own parent';
    end if;
    if not exists (
      select 1 from public.tasks
      where id = p_parent_task_id
        and project_id = v_current.project_id
        and kind = 'task'
        and deleted_at is null
    ) then
      raise exception 'Parent task not found in this project';
    end if;
    if exists (
      with recursive descendants as (
        select id from public.tasks
        where parent_task_id = p_task_id and deleted_at is null
        union all
        select child.id
        from public.tasks child
        join descendants parent on child.parent_task_id = parent.id
        where child.deleted_at is null
      )
      select 1 from descendants where id = p_parent_task_id
    ) then
      raise exception 'Parent task would create a cycle';
    end if;
  end if;

  update public.tasks
  set
    title = case when p_title is null then title else btrim(p_title) end,
    description = case
      when p_set_description then nullif(btrim(p_description), '')
      else description
    end,
    priority = coalesce(p_priority, priority),
    due_date = case when p_set_due_date then p_due_date else due_date end,
    is_client_visible = coalesce(p_is_client_visible, is_client_visible),
    assignee_id = case when p_set_assignee then p_assignee_id else assignee_id end,
    parent_task_id = case when p_set_parent_task then p_parent_task_id else parent_task_id end,
    estimated_hours = case
      when p_set_estimated_hours then p_estimated_hours
      else estimated_hours
    end,
    is_billable = coalesce(p_is_billable, is_billable)
  where id = p_task_id and version = p_expected_version
  returning * into v_task;

  if not found then
    raise exception 'Task version conflict; read it again before updating';
  end if;

  if p_set_assignee then
    delete from public.task_members where task_id = v_task.id;
    if p_assignee_id is not null then
      insert into public.task_members(task_id, member_id)
      values (v_task.id, p_assignee_id);
    end if;
  end if;

  insert into public.activity_log(entity_type, entity_id, action, details)
  values (
    'task', v_task.id, 'mcp.updated',
    jsonb_build_object(
      'version', v_task.version,
      'assignment_changed', p_set_assignee,
      'parent_changed', p_set_parent_task
    )
  );

  return jsonb_build_object(
    'id', v_task.id,
    'projectId', v_task.project_id,
    'status', v_task.status,
    'version', v_task.version,
    'assigneeId', v_task.assignee_id
  );
end;
$$;

revoke all on function public.mcp_create_project_task(
  uuid, text, text, text, date, boolean, uuid, uuid, numeric, boolean, uuid
) from public, anon, authenticated;
revoke all on function public.mcp_update_project_task(
  uuid, bigint, text, boolean, text, text, boolean, date, boolean,
  boolean, uuid, boolean, uuid, boolean, numeric, boolean
) from public, anon, authenticated;

grant execute on function public.mcp_create_project_task(
  uuid, text, text, text, date, boolean, uuid, uuid, numeric, boolean, uuid
) to anon, authenticated;
grant execute on function public.mcp_update_project_task(
  uuid, bigint, text, boolean, text, text, boolean, date, boolean,
  boolean, uuid, boolean, uuid, boolean, numeric, boolean
) to anon, authenticated;

notify pgrst, 'reload schema';