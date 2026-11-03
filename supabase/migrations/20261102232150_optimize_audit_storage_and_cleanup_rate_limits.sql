create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_row jsonb;
  before_snapshot jsonb;
  after_snapshot jsonb;
  changed_fields jsonb := '[]'::jsonb;
  changed_keys text[] := array[]::text[];
begin
  changed_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(field.key order by field.key), array[]::text[])
    into changed_keys
    from jsonb_each(to_jsonb(new)) as field(key, value)
    where to_jsonb(old) -> field.key is distinct from field.value;

    select coalesce(jsonb_agg(to_jsonb(keys.field_name) order by keys.field_name), '[]'::jsonb)
    into changed_fields
    from unnest(changed_keys) as keys(field_name);

    select coalesce(jsonb_object_agg(keys.field_name, to_jsonb(old) -> keys.field_name), '{}'::jsonb)
    into before_snapshot
    from unnest(changed_keys) as keys(field_name);

    select coalesce(jsonb_object_agg(keys.field_name, to_jsonb(new) -> keys.field_name), '{}'::jsonb)
    into after_snapshot
    from unnest(changed_keys) as keys(field_name);

    before_snapshot := public.audit_redact(before_snapshot);
    after_snapshot := public.audit_redact(after_snapshot);
  elsif tg_op = 'DELETE' then
    before_snapshot := public.audit_redact(to_jsonb(old));
  else
    after_snapshot := public.audit_redact(to_jsonb(new));
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
    before_snapshot,
    after_snapshot,
    case when tg_op = 'UPDATE' then jsonb_build_object('changed_fields', changed_fields) else '{}'::jsonb end,
    case when auth.uid() is null then 'system' else 'backoffice' end
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function public.audit_row_change() is
  'Writes redacted full row images for inserts/deletes and only changed redacted fields for updates.';

-- Opportunistically remove a small batch of expired buckets on each request.
-- This keeps the limiter self-maintaining without requiring pg_cron. The
-- indexed reset_at predicate ensures live buckets are never touched.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_bucket public.rate_limit_buckets;
  next_reset timestamptz := now() + make_interval(secs => greatest(p_window_seconds, 1));
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 300 then
    return false;
  end if;
  if p_limit < 1 or p_limit > 10000 then
    return false;
  end if;

  with expired_buckets as (
    select bucket.key
    from public.rate_limit_buckets as bucket
    where bucket.reset_at < now()
      and bucket.key <> p_key
    order by bucket.reset_at
    limit 100
    for update skip locked
  )
  delete from public.rate_limit_buckets as bucket
  using expired_buckets
  where bucket.key = expired_buckets.key;

  insert into public.rate_limit_buckets (key, count, reset_at)
  values (p_key, 1, next_reset)
  on conflict (key) do update
    set count = case
      when public.rate_limit_buckets.reset_at <= now() then 1
      else public.rate_limit_buckets.count + 1
    end,
    reset_at = case
      when public.rate_limit_buckets.reset_at <= now() then excluded.reset_at
      else public.rate_limit_buckets.reset_at
    end,
    updated_at = now()
  returning * into current_bucket;

  return current_bucket.reset_at > now() and current_bucket.count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Atomically checks a rate limit and opportunistically removes up to 100 expired buckets per request.';
