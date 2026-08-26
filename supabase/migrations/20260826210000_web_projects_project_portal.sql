-- Link web inventory entries to delivery projects and optionally expose their
-- safe public URL in the matching client portal.

alter table public.web_projects
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists is_client_visible boolean not null default false;

create index if not exists web_projects_project_idx
  on public.web_projects(project_id)
  where deleted_at is null and project_id is not null;

comment on column public.web_projects.project_id is
  'Optional delivery project represented by this website or demo.';
comment on column public.web_projects.is_client_visible is
  'When true and linked to a project, name and URL are shown in that project portal.';

notify pgrst, 'reload schema';
