-- New tasks are shared with the client by default. Existing rows are unchanged,
-- and every creation surface keeps an explicit opt-out for internal tasks.

alter table public.tasks
  alter column is_client_visible set default true;

comment on column public.tasks.is_client_visible is
  'Client-visible by default; set false explicitly for an internal task.';

notify pgrst, 'reload schema';