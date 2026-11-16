-- Optional, client-facing development workflow. Existing and new proposals start empty.
alter table public.proposals add column development_approach text
  constraint proposals_development_approach_check
  check (development_approach is null or length(development_approach) <= 20000);

comment on column public.proposals.development_approach is
  'Optional Markdown workflow shown after project scope; hidden when empty.';

-- Non-price field: keep the existing column grants and RLS policies intact.
grant select (development_approach) on public.proposals to authenticated;

-- Extend the current atomic editor save without replacing its permission,
-- concurrency, pricing or payment-plan logic. Fail safely on schema drift.
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
  definition := replace(definition, allowed, allowed || ', ''development_approach''');
  definition := replace(definition, assignment, assignment || E'\n' ||
    $after$    development_approach = case when p_patch ? 'development_approach' then nullif(btrim(p_patch ->> 'development_approach'), '') else development_approach end,$after$);
  execute definition;
end;
$migration$;