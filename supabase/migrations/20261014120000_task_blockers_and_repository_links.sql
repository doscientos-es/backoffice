-- Internal blocker metadata; client portals continue to use explicit safe fields.
alter table public.tasks
  add column blocked_reason text,
  add column blocked_at timestamptz,
  add column blocker_owner_id uuid references public.team_members(id) on delete set null,
  add column blocker_review_on date,
  add constraint tasks_blocker_reason_length check (
    blocked_reason is null or length(btrim(blocked_reason)) between 1 and 1000
  ),
  add constraint tasks_blocker_consistency check (
    (blocked_reason is null and blocked_at is null and blocker_owner_id is null and blocker_review_on is null)
    or (blocked_reason is not null and blocked_at is not null and kind = 'task' and status not in ('done', 'cancelled'))
  );

create function public.normalize_task_blocker() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.blocked_reason := nullif(btrim(new.blocked_reason), '');
  if new.status in ('done', 'cancelled') or new.blocked_reason is null then
    new.blocked_reason := null;
    new.blocked_at := null;
    new.blocker_owner_id := null;
    new.blocker_review_on := null;
  elsif tg_op = 'INSERT' then
    new.blocked_at := now();
  elsif old.blocked_reason is null then
    new.blocked_at := now();
  else
    new.blocked_at := old.blocked_at;
  end if;
  return new;
end;
$$;
create trigger normalize_task_blocker before insert or update on public.tasks
for each row execute function public.normalize_task_blocker();
create index tasks_open_blockers_idx on public.tasks (project_id, blocker_review_on, blocked_at)
where deleted_at is null and blocked_reason is not null;

-- Shared by authenticated backoffice actions and the existing token-authenticated MCP.
create function public.set_task_blocker(
  p_task_id uuid, p_expected_version bigint, p_reason text,
  p_owner_id uuid default null, p_review_on date default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks%rowtype;
  v_before public.tasks%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_mcp boolean := coalesce(public.has_valid_mcp_access_token(), false);
begin
  if not v_mcp and not (public.has_permission('tasks.write') and public.can_access_task(p_task_id)) then
    raise exception 'No tienes permisos para modificar este bloqueo.' using errcode = '42501';
  end if;
  select * into v_before from public.tasks
    where id = p_task_id and kind = 'task' and deleted_at is null for update;
  if not found or (v_mcp and v_before.project_id is null) then
    raise exception 'Tarea no disponible.' using errcode = 'P0002';
  end if;
  if not v_mcp and public.current_member_role()::text = 'delivery' and not exists (
    select 1 from public.project_team_members where project_id = v_before.project_id and member_id = auth.uid()
  ) then
    raise exception 'Solo puedes modificar tareas de proyectos donde colaboras.' using errcode = '42501';
  end if;
  if p_expected_version is null or v_before.version <> p_expected_version then
    raise exception 'La tarea ha cambiado. Recarga antes de guardar.' using errcode = '40001';
  end if;
  if v_reason is not null and (length(v_reason) > 1000 or v_before.status in ('done', 'cancelled')) then
    raise exception 'Indica un motivo de hasta 1000 caracteres en una tarea abierta.';
  end if;
  if v_reason is not null and p_owner_id is not null and not exists (
    select 1 from public.team_members where id = p_owner_id and deleted_at is null
  ) then
    raise exception 'El responsable no está disponible.';
  end if;
  update public.tasks set blocked_reason = v_reason,
    blocker_owner_id = case when v_reason is null then null else p_owner_id end,
    blocker_review_on = case when v_reason is null then null else p_review_on end
    where id = p_task_id returning * into v_task;
  insert into public.activity_log(entity_type, entity_id, action, details)
    values ('task', p_task_id, case when v_reason is null then 'task.unblocked' else 'task.blocked' end,
      jsonb_build_object('blocked_at', v_before.blocked_at, 'owner_id', v_task.blocker_owner_id,
        'review_on', v_task.blocker_review_on, 'origin', case when v_mcp then 'mcp' else 'backoffice' end));
  return jsonb_build_object('id', v_task.id, 'projectId', v_task.project_id,
    'version', v_task.version, 'blockedReason', v_task.blocked_reason, 'blockedAt', v_task.blocked_at);
end;
$$;

-- A link never turns on automatic writes to GitHub. Existing full sync must be
-- changed explicitly through project settings, not silently downgraded here.
create function public.link_project_repository(
  p_project_id uuid, p_expected_version bigint, p_repository text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_project public.projects%rowtype;
  v_repository text := regexp_replace(btrim(p_repository), '/$', '');
  v_owner text;
  v_name text;
  v_mcp boolean := coalesce(public.has_valid_mcp_access_token(), false);
begin
  if not v_mcp and not (public.has_permission('projects.write') and public.can_access_project(p_project_id)) then
    raise exception 'No tienes permisos para enlazar este repositorio.' using errcode = '42501';
  end if;
  if v_repository is null or v_repository !~ '^https://github[.]com/[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]+$'
     or length(v_repository) > 500 then
    raise exception 'Usa https://github.com/organizacion/repositorio, sin credenciales ni parámetros.';
  end if;
  v_owner := split_part(v_repository, '/', 4);
  v_name := regexp_replace(split_part(v_repository, '/', 5), '[.]git$', '');
  if v_name in ('', '.', '..') then raise exception 'Nombre de repositorio inválido.'; end if;
  v_repository := 'https://github.com/' || v_owner || '/' || v_name;
  select * into v_project from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then raise exception 'Proyecto no disponible.' using errcode = 'P0002'; end if;
  if p_expected_version is null or v_project.version <> p_expected_version then
    raise exception 'El proyecto ha cambiado. Recarga antes de guardar.' using errcode = '40001';
  end if;
  if v_project.github_sync_mode = 'bidirectional' and
     lower(regexp_replace(regexp_replace(v_project.github_repo, '/$', ''), '[.]git$', '')) is distinct from lower(v_repository) then
    raise exception 'Este proyecto sincroniza con GitHub. Cambia su repositorio desde Editar proyecto.';
  end if;
  if v_project.github_sync_mode <> 'bidirectional' then
    update public.projects set github_repo = v_repository, github_repo_owner = v_owner,
      github_repo_name = v_name, github_sync_mode = 'link_only', github_auto_sync = false,
      github_installation_id = null
      where id = p_project_id returning * into v_project;
    insert into public.activity_log(entity_type, entity_id, action, details)
      values ('project', p_project_id, 'project.repository_linked', jsonb_build_object('repository', v_repository));
  end if;
  return jsonb_build_object('id', v_project.id, 'version', v_project.version,
    'githubRepo', v_project.github_repo, 'githubSyncMode', v_project.github_sync_mode);
end;
$$;

revoke all on function public.normalize_task_blocker() from public, anon, authenticated;
revoke all on function public.set_task_blocker(uuid, bigint, text, uuid, date) from public, anon, authenticated;
revoke all on function public.link_project_repository(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.set_task_blocker(uuid, bigint, text, uuid, date) to anon, authenticated;
grant execute on function public.link_project_repository(uuid, bigint, text) to anon, authenticated;
notify pgrst, 'reload schema';