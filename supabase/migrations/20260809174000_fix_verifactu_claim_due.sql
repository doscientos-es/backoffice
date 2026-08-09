-- Qualify CTE columns so they do not collide with the OUT parameter names of
-- this PL/pgSQL function.
create or replace function public.claim_due_verifactu_outboxes(
  p_limit integer,
  p_worker_id text
)
returns table (outbox_id uuid, ledger_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.verifactu_outbox
     set state = 'retryable_error',
         next_attempt_at = clock_timestamp(),
         locked_at = null,
         locked_by = null,
         last_error = coalesce(last_error, 'El procesamiento anterior expiró')
   where state = 'processing'
     and locked_at < clock_timestamp() - interval '15 minutes';

  return query
  with due as (
    select id
      from public.verifactu_outbox
     where state in ('queued', 'retryable_error')
       and next_attempt_at <= clock_timestamp()
     order by next_attempt_at, created_at
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 1), 50))
  ), claimed as (
    update public.verifactu_outbox o
       set state = 'processing',
           locked_at = clock_timestamp(),
           locked_by = p_worker_id,
           last_attempt_at = clock_timestamp(),
           attempt_count = o.attempt_count + 1
      from due
     where o.id = due.id
     returning o.id, o.ledger_id
  )
  select claimed.id, claimed.ledger_id from claimed;
end;
$$;

revoke all on function public.claim_due_verifactu_outboxes(integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_due_verifactu_outboxes(integer, text)
  to service_role;