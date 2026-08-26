-- Portable code locations for agents working from different local clones.
-- Paths are always relative to the shared workspace root; absolute paths and
-- traversal segments are rejected at the database boundary.

create or replace function public.are_safe_project_workspace_paths(p_paths text[])
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(array_length(p_paths, 1), 0) <= 20
    and not exists (
      select 1
      from unnest(p_paths) as item(path)
      where path is null
        or path = ''
        or path <> btrim(path)
        or length(path) > 240
        or (
          path <> '.' and (
            position(chr(92) in path) > 0
            or path ~ '(^/|/$|//|^[A-Za-z]:|^~|(^|/)\.\.?(/|$)|[[:cntrl:]])'
          )
        )
    );
$$;

alter table public.projects
  add column if not exists workspace_paths text[] not null default '{}'::text[];

alter table public.projects
  drop constraint if exists projects_workspace_paths_safe,
  add constraint projects_workspace_paths_safe
    check (public.are_safe_project_workspace_paths(workspace_paths));

comment on column public.projects.workspace_paths is
  'Workspace-relative POSIX paths used by coding agents. Never stores developer-specific absolute paths.';

-- Seed only unconfigured, unambiguous projects that live in this monorepo.
update public.projects
set workspace_paths = array['internal/landing']::text[]
where name = 'Landing doscientos' and workspace_paths = '{}'::text[];

update public.projects
set workspace_paths = array['internal/backoffice', 'internal/mcp']::text[]
where name = 'Backoffice doscientos' and workspace_paths = '{}'::text[];

update public.projects
set workspace_paths = array['clients/electrico/crm']::text[]
where name = 'Desarrollo sistema de gestión CRM web' and workspace_paths = '{}'::text[];

notify pgrst, 'reload schema';
