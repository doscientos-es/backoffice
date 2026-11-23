-- Existing proposals keep their original signer choice; only new drafts default to business.
alter table public.proposals add column client_capacity text
  check (client_capacity in ('business', 'consumer'));
alter table public.proposals alter column client_capacity set default 'business';
grant select (client_capacity) on public.proposals to authenticated;

-- Keep the capacity part of the issued document, including when it is reopened.
create function public.protect_issued_proposal_capacity()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status <> 'draft' and new.client_capacity is distinct from old.client_capacity then
    raise exception 'Reabre la propuesta para modificar su tipo de contratación';
  end if;
  return new;
end;
$$;
create trigger protect_issued_proposal_capacity before update on public.proposals
  for each row execute function public.protect_issued_proposal_capacity();

-- Extend the atomic, versioned editor save without replacing its other rules.
do $migration$
declare
  definition text := pg_get_functiondef('public.update_proposal_items_versioned(uuid,bigint,jsonb,jsonb)'::regprocedure);
  allowed text := $before$'discount_type', 'discount_value', 'discount_reason'$before$;
  assignment text := $before$    notes = case when p_patch ? 'notes' then p_patch ->> 'notes' else notes end,$before$;
begin
  if length(definition) - length(replace(definition, allowed, '')) <> length(allowed)
     or length(definition) - length(replace(definition, assignment, '')) <> length(assignment) then
    raise exception 'Unexpected update_proposal_items_versioned definition';
  end if;
  definition := replace(definition, allowed, allowed || ', ''client_capacity''');
  definition := replace(definition, assignment, assignment || E'\n' ||
    $after$    client_capacity = case when p_patch ? 'client_capacity' then p_patch ->> 'client_capacity' else client_capacity end,$after$);
  execute definition;
end;
$migration$;
notify pgrst, 'reload schema';