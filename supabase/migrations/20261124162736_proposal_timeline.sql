-- Optional delivery milestones; older proposals remain unchanged.
alter table public.proposals add column timeline jsonb not null default '[]'::jsonb
  constraint proposals_timeline_check check (jsonb_typeof(timeline) = 'array' and jsonb_array_length(timeline) <= 60);
grant select (timeline) on public.proposals to authenticated;

-- Keep the existing atomic, versioned item save and fail on unexpected drift.
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
  definition := replace(definition, allowed, allowed || ', ''timeline''');
  definition := replace(definition, assignment, assignment || E'\n' ||
    $after$    timeline = case when p_patch ? 'timeline' then p_patch -> 'timeline' else timeline end,$after$);
  execute definition;
end;
$migration$;

-- Issued documents cannot be modified until reopened, including their timeline.
do $migration$
declare
  definition text := pg_get_functiondef('public.protect_issued_proposal_content()'::regprocedure);
  field text := $before$'development_approach','deliverables','acceptance_criteria','payment_schedule'$before$;
begin
  if length(definition) - length(replace(definition, field, '')) <> length(field) then
    raise exception 'Unexpected protect_issued_proposal_content definition';
  end if;
  execute replace(definition, field, field || ',''timeline''');
end;
$migration$;
notify pgrst, 'reload schema';