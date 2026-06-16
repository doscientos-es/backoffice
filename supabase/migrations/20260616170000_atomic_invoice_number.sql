-- Atomically reserve the next invoice number for a given series.
--
-- Uses a transaction-level advisory lock keyed on the series name hash so
-- concurrent calls for the same series are serialised while calls for
-- different series remain independent. The lock is released automatically
-- when the surrounding transaction commits or rolls back.
--
-- Usage (from application code):
--   const { data: nextNumber } = await supabase
--     .rpc('next_invoice_number', { p_series: 'A' });

create or replace function public.next_invoice_number(p_series text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  -- Acquire a transaction-level advisory lock on this series.
  -- hashtext() maps any text to a stable int4, satisfying the int8 param
  -- by implicit promotion.
  perform pg_advisory_xact_lock(hashtext(p_series)::bigint);

  select coalesce(max(number), 0) + 1
    into v_next
    from public.invoices
   where series = p_series;

  return v_next;
end;
$$;

-- Grant execute to the authenticated and service roles used by the app.
grant execute on function public.next_invoice_number(text) to authenticated;
grant execute on function public.next_invoice_number(text) to service_role;
