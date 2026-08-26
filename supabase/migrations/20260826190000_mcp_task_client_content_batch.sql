-- Client text and generation provenance are stored separately from internal task data.
-- Public portal queries select only the client-safe fields they need.

alter table public.tasks
  add column if not exists client_title text,
  add column if not exists client_summary text,
  add column if not exists created_via text not null default 'backoffice';

alter table public.tasks
  drop constraint if exists tasks_created_via_check;
alter table public.tasks
  add constraint tasks_created_via_check
  check (created_via in ('backoffice', 'mcp'));

create or replace function public.mcp_create_project_task_with_client_content(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_client_title text,
  p_client_summary text,
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
  v_result jsonb;
  v_task_id uuid;
  v_version bigint;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if p_client_title is not null and (length(btrim(p_client_title)) < 1 or length(p_client_title) > 200) then
    raise exception 'Client title must contain 1 to 200 characters';
  end if;
  if p_client_summary is not null and length(p_client_summary) > 8000 then
    raise exception 'Client summary is too long';
  end if;

  v_result := public.mcp_create_project_task(
    p_project_id, p_title, p_description, p_priority, p_due_date,
    p_is_client_visible, p_assignee_id, p_parent_task_id,
    p_estimated_hours, p_is_billable, p_idempotency_key
  );
  v_task_id := (v_result ->> 'id')::uuid;

  update public.tasks
  set client_title = nullif(btrim(p_client_title), ''),
      client_summary = nullif(btrim(p_client_summary), ''),
      created_via = 'mcp'
  where id = v_task_id
  returning version into v_version;

  return v_result || jsonb_build_object(
    'version', v_version,
    'clientTitle', nullif(btrim(p_client_title), ''),
    'clientSummary', nullif(btrim(p_client_summary), ''),
    'createdVia', 'mcp'
  );
end;
$$;

create or replace function public.mcp_batch_create_project_tasks(
  p_project_id uuid,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) not between 1 and 50 then
    raise exception 'Batch must contain 1 to 50 tasks';
  end if;

  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    if v_item ->> 'idempotencyKey' is null then
      raise exception 'Every batch task requires an idempotencyKey';
    end if;
    v_results := v_results || jsonb_build_array(public.mcp_create_project_task_with_client_content(
      p_project_id,
      v_item ->> 'title',
      v_item ->> 'description',
      v_item ->> 'clientTitle',
      v_item ->> 'clientSummary',
      coalesce(v_item ->> 'priority', 'medium'),
      (v_item ->> 'dueDate')::date,
      coalesce((v_item ->> 'clientVisible')::boolean, true),
      (v_item ->> 'assigneeId')::uuid,
      (v_item ->> 'parentTaskId')::uuid,
      (v_item ->> 'estimatedHours')::numeric,
      coalesce((v_item ->> 'billable')::boolean, true),
      (v_item ->> 'idempotencyKey')::uuid
    ));
  end loop;

  return jsonb_build_object('projectId', p_project_id, 'tasks', v_results, 'count', jsonb_array_length(v_results));
end;
$$;

revoke all on function public.mcp_create_project_task_with_client_content(
  uuid, text, text, text, text, text, date, boolean, uuid, uuid, numeric, boolean, uuid
) from public, anon, authenticated;
revoke all on function public.mcp_batch_create_project_tasks(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.mcp_create_project_task_with_client_content(
  uuid, text, text, text, text, text, date, boolean, uuid, uuid, numeric, boolean, uuid
) to anon, authenticated;
grant execute on function public.mcp_batch_create_project_tasks(uuid, jsonb)
  to anon, authenticated;

notify pgrst, 'reload schema';