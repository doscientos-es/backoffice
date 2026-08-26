-- Restricted project-task mutations for the internal MCP.
-- The MCP keeps using its existing hashed access token, but may only mutate
-- tasks through these allowlisted SECURITY DEFINER functions.

alter table public.tasks
  add column if not exists is_client_visible boolean not null default false,
  add column if not exists mcp_idempotency_key uuid;

create unique index if not exists tasks_mcp_idempotency_key_idx
  on public.tasks(mcp_idempotency_key)
  where mcp_idempotency_key is not null;

comment on column public.tasks.is_client_visible is
  'Explicit opt-in for showing the task title, status and due date in the project portal.';
comment on column public.tasks.mcp_idempotency_key is
  'Optional retry key supplied by the MCP when creating a task.';

create or replace function public.mcp_create_project_task(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_due_date date,
  p_is_client_visible boolean,
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
  if not exists (
    select 1 from public.projects
    where id = p_project_id and deleted_at is null
  ) then
    raise exception 'Project not found';
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
        'idempotentReplay', true
      );
    end if;
  end if;

  insert into public.tasks (
    project_id, kind, title, description, status, priority, due_date,
    is_client_visible, mcp_idempotency_key, kanban_order
  ) values (
    p_project_id, 'task', btrim(p_title), nullif(btrim(p_description), ''),
    'todo', p_priority, p_due_date, p_is_client_visible,
    p_idempotency_key, 'm'
  )
  returning * into v_task;

  insert into public.activity_log(entity_type, entity_id, action, details)
  values (
    'task', v_task.id, 'mcp.created',
    jsonb_build_object('project_id', p_project_id, 'client_visible', p_is_client_visible)
  );

  return jsonb_build_object(
    'id', v_task.id,
    'projectId', v_task.project_id,
    'status', v_task.status,
    'version', v_task.version,
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
  p_is_client_visible boolean
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
  if p_title is not null and (length(btrim(p_title)) < 1 or length(p_title) > 200) then
    raise exception 'Task title must contain 1 to 200 characters';
  end if;
  if p_set_description and p_description is not null and length(p_description) > 8000 then
    raise exception 'Task description is too long';
  end if;
  if p_priority is not null and p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid task priority';
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
    is_client_visible = coalesce(p_is_client_visible, is_client_visible)
  where id = p_task_id
    and kind = 'task'
    and project_id is not null
    and deleted_at is null
    and version = p_expected_version
  returning * into v_task;

  if not found then
    if exists (select 1 from public.tasks where id = p_task_id and deleted_at is null) then
      raise exception 'Task version conflict; read it again before updating';
    end if;
    raise exception 'Task not found';
  end if;

  insert into public.activity_log(entity_type, entity_id, action, details)
  values ('task', v_task.id, 'mcp.updated', jsonb_build_object('version', v_task.version));

  return jsonb_build_object(
    'id', v_task.id,
    'projectId', v_task.project_id,
    'status', v_task.status,
    'version', v_task.version
  );
end;
$$;

create or replace function public.mcp_set_task_status(
  p_task_id uuid,
  p_expected_version bigint,
  p_status text
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
  if p_status not in ('todo', 'in_progress', 'in_review', 'done', 'cancelled') then
    raise exception 'Invalid task status';
  end if;

  update public.tasks
  set
    status = p_status,
    started_at = case
      when p_status = 'in_progress' then coalesce(started_at, now())
      else started_at
    end,
    completed_at = case when p_status = 'done' then now() else null end
  where id = p_task_id
    and kind = 'task'
    and project_id is not null
    and deleted_at is null
    and version = p_expected_version
  returning * into v_task;

  if not found then
    if exists (select 1 from public.tasks where id = p_task_id and deleted_at is null) then
      raise exception 'Task version conflict; read it again before updating';
    end if;
    raise exception 'Task not found';
  end if;

  insert into public.activity_log(entity_type, entity_id, action, details)
  values (
    'task', v_task.id, 'mcp.status_changed',
    jsonb_build_object('status', v_task.status, 'version', v_task.version)
  );

  return jsonb_build_object(
    'id', v_task.id,
    'projectId', v_task.project_id,
    'status', v_task.status,
    'version', v_task.version
  );
end;
$$;

revoke all on function public.mcp_create_project_task(uuid, text, text, text, date, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.mcp_update_project_task(uuid, bigint, text, boolean, text, text, boolean, date, boolean)
  from public, anon, authenticated;
revoke all on function public.mcp_set_task_status(uuid, bigint, text)
  from public, anon, authenticated;

grant execute on function public.mcp_create_project_task(uuid, text, text, text, date, boolean, uuid)
  to anon, authenticated;
grant execute on function public.mcp_update_project_task(uuid, bigint, text, boolean, text, text, boolean, date, boolean)
  to anon, authenticated;
grant execute on function public.mcp_set_task_status(uuid, bigint, text)
  to anon, authenticated;

notify pgrst, 'reload schema';