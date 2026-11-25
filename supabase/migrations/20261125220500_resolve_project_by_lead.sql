-- Keep existing RPC contracts, grants and authentication checks. Only replace
-- their old project/recipient lookups, and abort if an expected SQL fragment changed.
do $migration$
declare
  target regprocedure;
  definition text;
  rewritten text;
  join_pattern constant text := '\s+join\s+public\.clients\s+c\s+on\s+c\.id\s*=\s*p\.client_id';
  old_fragments text[];
  new_fragments text[];
  i integer;
begin
  foreach target in array array[
    'public.resolve_interaction_project()'::regprocedure,
    'public.mcp_log_work_hours(uuid,uuid,uuid,date,numeric,text)'::regprocedure,
    'public.mcp_log_team_work_hours(uuid,uuid,date,jsonb,text)'::regprocedure,
    'public.mcp_get_work_hours(uuid,uuid,uuid,text,date,date)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    if (select count(*) from regexp_matches(definition, join_pattern, 'gi')) <>
      case when target = 'public.resolve_interaction_project()'::regprocedure then 2 else 3 end then
      raise exception 'Unexpected project join in %', target;
    end if;
    rewritten := regexp_replace(definition, join_pattern, '', 'gi');
    rewritten := replace(rewritten, 'c.lead_id', 'p.lead_id');
    rewritten := regexp_replace(rewritten, '\s+and\s+c\.deleted_at\s+is\s+null', '', 'gi');
    execute rewritten;
  end loop;

  target := 'public.mcp_create_project(uuid,uuid,jsonb,uuid)'::regprocedure;
  definition := pg_get_functiondef(target);
  old_fragments := array[
    'v_lead_id := public.mcp_assert_project_client_relationship(p_client_id, p_lead_id, p_lead_id is not null);',
    'insert into public.projects (client_id, name,',
    'values (p_client_id, btrim(p_patch',
    '''clientId'', v_project.client_id, ''version'''
  ];
  new_fragments := array[
    $sql$if p_client_id is null then
    perform public.mcp_assert_commercial_relationship(null, p_lead_id);
    v_lead_id := p_lead_id;
  else
    v_lead_id := public.mcp_assert_project_client_relationship(p_client_id, p_lead_id, p_lead_id is not null);
  end if;$sql$,
    'insert into public.projects (client_id, lead_id, name,',
    'values (p_client_id, v_lead_id, btrim(p_patch',
    '''clientId'', v_project.client_id, ''leadId'', v_project.lead_id, ''version'''
  ];
  for i in 1..cardinality(old_fragments) loop
    rewritten := replace(definition, old_fragments[i], new_fragments[i]);
    if rewritten = definition then raise exception 'Unexpected definition for % (fragment %)', target, i; end if;
    definition := rewritten;
  end loop;
  execute definition;

  target := 'public.mcp_update_project(uuid,bigint,uuid,boolean,jsonb)'::regprocedure;
  definition := pg_get_functiondef(target);
  rewritten := replace(definition,
    'v_lead := public.mcp_assert_project_client_relationship(v_client_id, p_lead_id, p_check_lead);',
    $sql$if v_client_id is not distinct from v_current.client_id then
    v_lead := v_current.lead_id;
    if p_check_lead and v_lead is distinct from p_lead_id then
      raise exception 'Project is not linked to the supplied lead';
    end if;
  else
    v_lead := public.mcp_assert_project_client_relationship(v_client_id, p_lead_id, p_check_lead);
  end if;$sql$);
  if rewritten = definition then raise exception 'Unexpected definition for %', target; end if;
  execute rewritten;
end $migration$;