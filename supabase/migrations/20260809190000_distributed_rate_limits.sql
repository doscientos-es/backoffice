-- Distributed public endpoint rate limiting.
-- The table is intentionally service-role only; clients consume the atomic RPC.
create table if not exists public.rate_limit_buckets (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
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

-- Keep expired buckets from accumulating forever. This is safe to run from a
-- daily cron and is also cheap enough for occasional opportunistic cleanup.
create index if not exists rate_limit_buckets_reset_at_idx
  on public.rate_limit_buckets (reset_at);
