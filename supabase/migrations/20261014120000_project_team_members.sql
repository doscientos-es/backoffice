-- Explicit project collaborators for scoped project access.
create table if not exists public.project_team_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, member_id)
);

create index if not exists project_team_members_member_idx
  on public.project_team_members(member_id, project_id);

alter table public.project_team_members enable row level security;

drop policy if exists project_team_members_select on public.project_team_members;
create policy project_team_members_select on public.project_team_members
  for select using (public.is_team_member());

drop policy if exists project_team_members_insert on public.project_team_members;
create policy project_team_members_insert on public.project_team_members
  for insert with check (public.has_permission('projects.write') and public.can_access_project(project_id));

drop policy if exists project_team_members_delete on public.project_team_members;
create policy project_team_members_delete on public.project_team_members
  for delete using (public.has_permission('projects.write') and public.can_access_project(project_id));

-- Limit collaborator writes to project-scoped work; they cannot change project records.
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update
  using (public.can_access_project(id) and public.has_permission('projects.write')
    and public.member_has_full_scope())
  with check (public.has_permission('projects.write') and public.member_has_full_scope());

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert
  with check (public.has_permission('projects.write') and public.member_has_full_scope());

drop policy if exists project_checklist_items_insert on public.project_checklist_items;
create policy project_checklist_items_insert on public.project_checklist_items for insert
  with check (public.has_permission('projects.write') and public.can_access_project(project_id));
drop policy if exists project_checklist_items_update on public.project_checklist_items;
create policy project_checklist_items_update on public.project_checklist_items for update
  using (public.has_permission('projects.write') and public.can_access_project(project_id))
  with check (public.has_permission('projects.write') and public.can_access_project(project_id));

drop policy if exists project_requests_insert on public.project_requests;
create policy project_requests_insert on public.project_requests for insert
  with check (public.has_permission('projects.write') and public.can_access_project(project_id));
drop policy if exists project_requests_update on public.project_requests;
create policy project_requests_update on public.project_requests for update
  using (public.has_permission('projects.write') and public.can_access_project(project_id))
  with check (public.has_permission('projects.write') and public.can_access_project(project_id));

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments for insert
  with check (public.has_permission('tasks.write') and public.can_access_task(task_id));
drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update on public.task_comments for update
  using (public.has_permission('tasks.write') and public.can_access_task(task_id))
  with check (public.has_permission('tasks.write') and public.can_access_task(task_id));
drop policy if exists task_tag_assignments_insert on public.task_tag_assignments;
create policy task_tag_assignments_insert on public.task_tag_assignments for insert
  with check (public.has_permission('tasks.write') and public.can_access_task(task_id));
drop policy if exists task_tag_assignments_delete on public.task_tag_assignments;
create policy task_tag_assignments_delete on public.task_tag_assignments for delete
  using (public.has_permission('tasks.write') and public.can_access_task(task_id));

-- Extend the existing assignment model; task/proposal assignments keep working.
create or replace function public.is_assigned_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
      select 1 from public.projects pr
      where pr.id = p_project_id and pr.created_by = auth.uid()
    )
    or exists (
      select 1 from public.project_team_members m
      where m.project_id = p_project_id and m.member_id = auth.uid()
    )
    or exists (
      select 1 from public.tasks t
      where t.project_id = p_project_id and t.deleted_at is null
        and (t.assignee_id = auth.uid() or t.created_by = auth.uid()
          or exists (select 1 from public.task_members m where m.task_id = t.id and m.member_id = auth.uid()))
    )
    or exists (
      select 1 from public.proposals p
      join public.proposal_team_members m on m.proposal_id = p.id
      where p.project_id = p_project_id and p.deleted_at is null and m.member_id = auth.uid()
    )
    or exists (
      select 1 from public.proposals p
      where p.project_id = p_project_id and p.deleted_at is null and p.created_by = auth.uid()
    );
$$;

-- Delivery members can record hours only for projects they can access.
drop policy if exists work_logs_insert on public.work_logs;
create policy work_logs_insert on public.work_logs for insert
  with check (public.has_permission('tasks.write') and member_id = auth.uid()
    and public.can_access_project(project_id));

drop policy if exists work_logs_update on public.work_logs;
create policy work_logs_update on public.work_logs for update
  using (member_id = auth.uid() or public.current_member_role() in ('owner','admin'))
  with check (member_id = auth.uid() or public.current_member_role() in ('owner','admin'));

drop policy if exists work_logs_delete on public.work_logs;
create policy work_logs_delete on public.work_logs for update
  using (member_id = auth.uid() or public.current_member_role() in ('owner','admin'))
  with check (member_id = auth.uid() or public.current_member_role() in ('owner','admin'));
