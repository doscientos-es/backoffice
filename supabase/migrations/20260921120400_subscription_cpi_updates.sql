-- Apply the annual CPI revision once per subscription and calendar year.
-- Existing subscriptions are considered already settled for the deployment year;
-- the first automatic revision will therefore happen on the following 1 January.
alter table public.subscriptions
  add column if not exists cpi_last_applied_year integer,
  add column if not exists cpi_last_applied_rate numeric(7,4),
  add column if not exists cpi_last_applied_at timestamptz;

update public.subscriptions
   set cpi_last_applied_year = extract(year from current_date)::integer
 where cpi_last_applied_year is null;

alter table public.subscriptions
  alter column cpi_last_applied_year set default extract(year from current_date)::integer,
  alter column cpi_last_applied_year set not null;

create table if not exists public.subscription_cpi_updates (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  adjustment_year integer not null,
  rate numeric(7,4) not null,
  amount_before numeric(12,2) not null,
  amount_after numeric(12,2) not null,
  source text not null default 'INE:IPC290750',
  applied_at timestamptz not null default now(),
  unique (subscription_id, adjustment_year)
);

create index if not exists subscription_cpi_updates_year_idx
  on public.subscription_cpi_updates(adjustment_year);

alter table public.subscription_cpi_updates enable row level security;

drop policy if exists subscription_cpi_updates_select on public.subscription_cpi_updates;
create policy subscription_cpi_updates_select on public.subscription_cpi_updates
  for select using (public.is_team_member());

create or replace function public.apply_subscription_cpi_update(
  p_adjustment_year integer,
  p_rate numeric,
  p_source text default 'INE:IPC290750'
)
returns table (
  adjustment_year integer,
  rate numeric,
  subscriptions_updated integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_amount_after numeric(12,2);
  v_update_id uuid;
  v_updated integer := 0;
begin
  if p_adjustment_year < 2000 or p_rate is null or p_rate <= -100 or p_rate > 100 then
    raise exception 'Invalid subscription CPI update';
  end if;

  for v_subscription in
    select *
      from public.subscriptions
     where status = 'active'
       and deleted_at is null
       and cpi_last_applied_year < p_adjustment_year
     order by id
     for update
  loop
    v_amount_after := round(v_subscription.amount * (1 + p_rate / 100), 2);
    v_update_id := null;

    insert into public.subscription_cpi_updates (
      subscription_id,
      adjustment_year,
      rate,
      amount_before,
      amount_after,
      source
    ) values (
      v_subscription.id,
      p_adjustment_year,
      p_rate,
      v_subscription.amount,
      v_amount_after,
      coalesce(nullif(trim(p_source), ''), 'INE:IPC290750')
    )
    on conflict (subscription_id, adjustment_year) do nothing
    returning id into v_update_id;

    if v_update_id is not null then
      update public.subscriptions
         set amount = v_amount_after,
             cpi_last_applied_year = p_adjustment_year,
             cpi_last_applied_rate = p_rate,
             cpi_last_applied_at = now()
       where id = v_subscription.id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  return query select p_adjustment_year, p_rate, v_updated;
end;
$$;

revoke all on function public.apply_subscription_cpi_update(integer, numeric, text)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_cpi_update(integer, numeric, text)
  to service_role;