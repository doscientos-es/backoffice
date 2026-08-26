-- Public project tracking and client request intake.

alter table public.projects
  add column if not exists portal_token text unique default encode(gen_random_bytes(24), 'hex'),
  add column if not exists is_client_visible boolean not null default false,
  add column if not exists portal_password_hash text;

create unique index if not exists projects_portal_token_idx
  on public.projects(portal_token)
  where deleted_at is null;

comment on column public.projects.is_client_visible is
  'When true, the project may be opened through /p/project/[portal_token].';

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null check (category in ('incident', 'change', 'question', 'material', 'complaint', 'maintenance')),
  subject text not null check (char_length(subject) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'closed')),
  requester_name text not null check (char_length(requester_name) between 1 and 160),
  requester_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_requests_project_idx
  on public.project_requests(project_id, created_at desc);

alter table public.tasks
  add column if not exists project_request_id uuid unique
    references public.project_requests(id) on delete set null;

alter table public.project_requests enable row level security;

drop policy if exists project_requests_select on public.project_requests;
create policy project_requests_select on public.project_requests
  for select using (public.is_team_member());
drop policy if exists project_requests_insert on public.project_requests;
create policy project_requests_insert on public.project_requests
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));
drop policy if exists project_requests_update on public.project_requests;
create policy project_requests_update on public.project_requests
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

drop trigger if exists trg_touch_project_requests on public.project_requests;
create trigger trg_touch_project_requests
  before update on public.project_requests
  for each row execute function public.fn_touch_updated_at();

create or replace function public.submit_project_request(
  p_portal_token text,
  p_category text,
  p_subject text,
  p_body text,
  p_requester_name text,
  p_requester_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_request_id uuid;
  v_task_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the backoffice service may submit portal requests' using errcode = '42501';
  end if;
  if p_category not in ('incident', 'change', 'question', 'material', 'complaint', 'maintenance') then
    raise exception 'Invalid request category';
  end if;
  if length(btrim(p_subject)) < 1 or length(p_subject) > 160 then
    raise exception 'Invalid request subject';
  end if;
  if length(btrim(p_body)) < 1 or length(p_body) > 4000 then
    raise exception 'Invalid request body';
  end if;
  if length(btrim(p_requester_name)) < 1 or length(p_requester_name) > 160 then
    raise exception 'Invalid requester name';
  end if;

  select id into v_project_id
  from public.projects
  where portal_token = p_portal_token
    and is_client_visible = true
    and deleted_at is null;
  if not found then raise exception 'Project portal not found'; end if;

  insert into public.project_requests (
    project_id, category, subject, body, requester_name, requester_email
  ) values (
    v_project_id, p_category, btrim(p_subject), btrim(p_body),
    btrim(p_requester_name), nullif(btrim(p_requester_email), '')
  ) returning id into v_request_id;

  insert into public.tasks (
    project_id, project_request_id, kind, title, description,
    status, priority, is_client_visible, kanban_order
  ) values (
    v_project_id, v_request_id, 'task',
    left('Solicitud del cliente · ' || btrim(p_subject), 200),
    btrim(p_body), 'todo',
    case when p_category in ('incident', 'complaint') then 'high' else 'medium' end,
    true, 'm'
  ) returning id into v_task_id;

  insert into public.activity_log(entity_type, entity_id, action, details)
  values (
    'project_request', v_request_id, 'portal.created',
    jsonb_build_object('project_id', v_project_id, 'task_id', v_task_id, 'category', p_category)
  );

  return v_request_id;
end;
$$;

revoke all on function public.submit_project_request(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_project_request(text, text, text, text, text, text)
  to service_role;

create or replace function public.sync_project_request_from_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_request_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  update public.project_requests
  set status = case new.status
    when 'todo' then 'new'
    when 'in_progress' then 'in_progress'
    when 'in_review' then 'in_progress'
    when 'done' then 'resolved'
    when 'cancelled' then 'closed'
  end
  where id = new.project_request_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_project_request_from_task on public.tasks;
create trigger trg_sync_project_request_from_task
  after update of status on public.tasks
  for each row execute function public.sync_project_request_from_task();

notify pgrst, 'reload schema';