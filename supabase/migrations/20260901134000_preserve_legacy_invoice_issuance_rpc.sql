-- Compatibility repair for databases where 20260901130000 was applied before
-- the legacy issuance endpoint was redirected to the number-allocation flow.
do $$
begin
  if to_regprocedure('public.issue_invoice_with_verifactu_outbox_base(uuid,jsonb)') is null then
    alter function public.issue_invoice_with_verifactu_outbox(uuid, jsonb)
      rename to issue_invoice_with_verifactu_outbox_base;
  end if;
end;
$$;

create or replace function public.issue_invoice_with_number_and_verifactu_outbox(
  p_invoice_id uuid,
  p_software jsonb
)
returns table (ledger_id uuid, outbox_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_number integer;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then
    raise exception 'No autorizado para emitir facturas';
  end if;

  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null
   for update;
  if not found then raise exception 'Factura no encontrada'; end if;

  if v_invoice.status = 'draft' and v_invoice.number is null then
    perform pg_advisory_xact_lock(hashtext('invoice-series:' || v_invoice.series)::bigint);
    select coalesce(max(number), 0) + 1
      into v_number
      from public.invoices
     where series = v_invoice.series;
    update public.invoices
       set number = v_number,
           updated_at = clock_timestamp()
     where id = v_invoice.id;
  end if;

  return query
    select * from public.issue_invoice_with_verifactu_outbox_base(p_invoice_id, p_software);
end;
$$;

create or replace function public.issue_invoice_with_verifactu_outbox(
  p_invoice_id uuid,
  p_software jsonb
)
returns table (ledger_id uuid, outbox_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select * from public.issue_invoice_with_number_and_verifactu_outbox(p_invoice_id, p_software);
end;
$$;

revoke all on function public.issue_invoice_with_verifactu_outbox_base(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.issue_invoice_with_verifactu_outbox(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.issue_invoice_with_number_and_verifactu_outbox(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.issue_invoice_with_verifactu_outbox(uuid, jsonb)
  to authenticated;
grant execute on function public.issue_invoice_with_number_and_verifactu_outbox(uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';