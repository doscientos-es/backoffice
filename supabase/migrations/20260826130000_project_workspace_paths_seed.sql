-- Seed portable paths only for projects whose client and code location are unambiguous.
-- Match stable business names instead of environment-specific generated IDs.

update public.projects as project
set workspace_paths = array['clients/gruas-del-valles/gv-landing']::text[]
from public.clients as client
where project.client_id = client.id
  and project.name = 'Landing'
  and client.name = 'Grúas del Vallés'
  and project.workspace_paths = '{}'::text[]
  and project.deleted_at is null;

update public.projects as project
set workspace_paths = array['clients/electrico/crm']::text[]
from public.clients as client
where project.client_id = client.id
  and project.name = 'CRM web'
  and client.name = 'OPTIENERGIA CONSULTING SL'
  and project.workspace_paths = '{}'::text[]
  and project.deleted_at is null;

notify pgrst, 'reload schema';