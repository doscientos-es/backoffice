-- A draft is an internal working document, not a fiscal invoice: it must not
-- consume a number from its series. Numbers are reserved atomically at issuance.

alter table public.invoices alter column number drop not null;

-- Existing drafts have never produced a RegistroAlta, so their reserved numbers
-- can be safely released. Issued and historical records remain untouched.
update public.invoices
   set number = null
 where status = 'draft'
   and number is not null;

alter table public.invoices
  drop constraint if exists invoices_number_required_after_issuance;
alter table public.invoices
  add constraint invoices_number_required_after_issuance
  check (status = 'draft' or number is not null);

-- Covers legacy SQL RPCs while they still include the old number column in
-- their INSERT statement. The generated full_number becomes null as well.
create or replace function public.clear_invoice_number_for_draft()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'draft' then
    new.number := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_invoice_number_for_draft on public.invoices;
create trigger trg_clear_invoice_number_for_draft
  before insert on public.invoices
  for each row execute function public.clear_invoice_number_for_draft();

-- Allocates a series number and emits the fiscal record in one transaction.
-- Delegating to the established issuance RPC retains its VERI*FACTU validation,
-- immutable snapshot, hash chain and durable outbox behavior.
alter function public.issue_invoice_with_verifactu_outbox(uuid, jsonb)
  rename to issue_invoice_with_verifactu_outbox_base;

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

-- Existing deployments can keep using the former endpoint until the application
-- release switches to the explicit issuance-with-number endpoint.
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
grant execute on function public.issue_invoice_with_number_and_verifactu_outbox(uuid, jsonb)
  to authenticated;
grant execute on function public.issue_invoice_with_verifactu_outbox(uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
