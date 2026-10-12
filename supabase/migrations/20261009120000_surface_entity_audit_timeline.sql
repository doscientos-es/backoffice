-- Preserve changed column names in the central audit without storing a second
-- copy of business values. Existing before/after snapshots remain redacted.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_row jsonb;
  changed_fields jsonb := '[]'::jsonb;
begin
  changed_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(field.key order by field.key), '[]'::jsonb)
    into changed_fields
    from jsonb_each(to_jsonb(new)) as field(key, value)
    where to_jsonb(old) -> field.key is distinct from field.value;
  end if;

  insert into public.audit_events (
    actor_id, actor_role, entity_type, entity_id, action,
    before_data, after_data, metadata, origin
  ) values (
    auth.uid(),
    public.current_member_role()::text,
    tg_table_name,
    changed_row->>'id',
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then public.audit_redact(to_jsonb(old)) end,
    case when tg_op in ('INSERT', 'UPDATE') then public.audit_redact(to_jsonb(new)) end,
    case when tg_op = 'UPDATE' then jsonb_build_object('changed_fields', changed_fields) else '{}'::jsonb end,
    case when auth.uid() is null then 'system' else 'backoffice' end
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Expose only event metadata and changed field names to team members who can
-- access the parent entity. Never return the audit snapshots through this RPC.
create or replace function public.list_entity_audit_timeline(
  p_entity_type text,
  p_entity_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  occurred_at timestamptz,
  actor_id uuid,
  actor_name text,
  action text,
  changed_fields text[],
  origin text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scoped_events as (
    select event.*,
      case
        when jsonb_typeof(event.metadata -> 'changed_fields') = 'array'
          then event.metadata -> 'changed_fields'
        else (
          select coalesce(jsonb_agg(field.key order by field.key), '[]'::jsonb)
          from jsonb_object_keys(coalesce(event.after_data, '{}'::jsonb)) as field(key)
          where event.before_data -> field.key is distinct from event.after_data -> field.key
        )
      end as raw_changed_fields
    from public.audit_events as event
    where event.entity_type = p_entity_type
      and event.entity_id = p_entity_id::text
      and event.action = 'update'
      and case p_entity_type
        when 'leads' then public.can_access_lead(p_entity_id)
        when 'clients' then public.can_access_client(p_entity_id)
        when 'projects' then public.can_access_project(p_entity_id)
        else false
      end
  ), visible_events as (
    select event.id, event.occurred_at, event.actor_id, event.action, event.origin,
      array_agg(distinct field.name order by field.name) as changed_fields
    from scoped_events as event
    cross join lateral jsonb_array_elements_text(event.raw_changed_fields) as field(name)
    where field.name not in (
      'created_at', 'updated_at', 'updated_by', 'version',
      'raw_payload', 'ip', 'device', 'browser'
    )
      and not (
        p_entity_type = 'leads'
        and field.name in ('status', 'assigned_to', 'lost_reason', 'lost_at', 'first_contacted_at')
      )
    group by event.id, event.occurred_at, event.actor_id, event.action, event.origin
  )
  select event.id, event.occurred_at, event.actor_id, member.name,
    event.action, event.changed_fields, event.origin
  from visible_events as event
  left join public.team_members as member on member.id = event.actor_id
  where cardinality(event.changed_fields) > 0
  order by event.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.list_entity_audit_timeline(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.list_entity_audit_timeline(text, uuid, integer) to authenticated;

comment on function public.list_entity_audit_timeline(text, uuid, integer) is
  'Returns scoped entity audit metadata and changed field names only; never exposes redacted snapshots.';