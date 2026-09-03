-- The MCP task RPCs introduced on 2026-08-26 accept planning metadata.
-- A previous migration removed these columns, leaving those RPCs unable to
-- create or update tasks. Restore only the metadata required by the RPC API.

alter table public.tasks
  add column if not exists estimated_hours numeric(6,2),
  add column if not exists is_billable boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_estimated_hours_range_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_estimated_hours_range_check
      check (estimated_hours is null or (estimated_hours > 0 and estimated_hours <= 9999.99));
  end if;
end;
$$;

notify pgrst, 'reload schema';