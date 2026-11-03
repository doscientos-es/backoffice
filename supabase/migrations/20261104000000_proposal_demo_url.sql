alter table public.proposals add column demo_url text;

alter table public.proposals add constraint proposals_demo_url_check
  check (demo_url is null or (length(demo_url) <= 2048 and demo_url ~* '^https?://[^[:space:]]+$'));

-- Preserve the current versioned item save implementation while adding the
-- new field to its allowlist and atomic proposal update. Fail on schema drift.
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
  definition := replace(definition, allowed, allowed || ', ''demo_url''');
  definition := replace(definition, assignment, assignment || E'\n' ||
    $after$    demo_url = case when p_patch ? 'demo_url' then p_patch ->> 'demo_url' else demo_url end,$after$);
  execute definition;
end;
$migration$;