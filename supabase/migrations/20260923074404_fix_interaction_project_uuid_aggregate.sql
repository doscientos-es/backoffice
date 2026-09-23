-- PostgreSQL has no min(uuid) aggregate. Keep the one-active-project rule
-- while selecting the UUID directly from the single matching project.
create or replace function public.resolve_interaction_project()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if new.project_id is null and new.lead_id is not null then
    select p.id into v_project_id
    from public.projects p
    join public.clients c on c.id = p.client_id
    where c.lead_id = new.lead_id
      and c.deleted_at is null
      and p.deleted_at is null
      and p.status <> 'cancelled'
    limit 1;

    if (
      select count(*)
      from public.projects p
      join public.clients c on c.id = p.client_id
      where c.lead_id = new.lead_id
        and c.deleted_at is null
        and p.deleted_at is null
        and p.status <> 'cancelled'
    ) <> 1 then
      v_project_id := null;
    end if;

    new.project_id := v_project_id;
  end if;
  return new;
end;
$$;
