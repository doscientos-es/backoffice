-- Shared, read-only history retrieval for the lead assistant and MCP.
-- SECURITY INVOKER deliberately preserves the caller's existing record-level policies.
create or replace function public.search_lead_history(
  p_lead_id uuid,
  p_query text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_type text default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_include_private boolean default false
) returns jsonb
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 50
    or p_offset is null or p_offset < 0 or p_offset > 10000
    or length(coalesce(p_query, '')) > 250
    or length(coalesce(p_type, '')) > 80
    or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'Invalid history filters' using errcode = '22023';
  end if;

  with matches as (
    select i.id, i.type::text as type, left(i.subject, 1000) as subject, i.created_at,
      case when p_include_private then left(i.body, 6000) end as body,
      case when p_include_private and i.type = 'meeting'
        then left(i.payload->'meet_artifacts'->>'summary', 8000) end as summary,
      coalesce(p_include_private and (length(i.body) > 6000 or
        (i.type = 'meeting' and length(i.payload->'meet_artifacts'->>'summary') > 8000)), false) as truncated
    from public.lead_interactions i
    where i.lead_id = p_lead_id
      and exists (select 1 from public.leads l where l.id = i.lead_id and l.deleted_at is null)
      and (p_from is null or i.created_at >= p_from)
      and (p_to is null or i.created_at <= p_to)
      and (p_type is null or i.type::text = p_type)
      -- Private fields cannot influence even the matches unless explicitly opted in.
      and (nullif(btrim(p_query), '') is null or
        to_tsvector('spanish', concat_ws(' ', i.subject,
          case when p_include_private then i.body end,
          case when p_include_private and i.type = 'meeting'
            then i.payload->'meet_artifacts'->>'summary' end))
        @@ plainto_tsquery('spanish', p_query))
    order by i.created_at desc, i.id desc
    limit p_limit + 1 offset p_offset
  ), page as (
    select * from matches order by created_at desc, id desc limit p_limit
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
    'hasMore', (select count(*) > p_limit from matches),
    'nextOffset', case when (select count(*) > p_limit from matches) then p_offset + p_limit end,
    'privateContentIncluded', coalesce(p_include_private, false),
    'dateField', 'created_at'
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.search_lead_history(uuid, text, timestamptz, timestamptz, text, integer, integer, boolean) from public, anon;
grant execute on function public.search_lead_history(uuid, text, timestamptz, timestamptz, text, integer, integer, boolean) to authenticated, service_role;