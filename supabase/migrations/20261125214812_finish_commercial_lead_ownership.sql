-- Project association is determined by the CRM owner, not the fiscal snapshot.
create or replace function public.mcp_assert_commercial_relationship(
  p_client_id uuid, p_lead_id uuid, p_project_id uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare billing_lead uuid; recipient uuid; project_lead uuid;
begin
  if p_client_id is not null then
    select lead_id into billing_lead from public.clients where id = p_client_id and deleted_at is null;
    if not found then raise exception 'Client not found'; end if;
    if p_lead_id is not null and p_lead_id is distinct from billing_lead then
      raise exception 'The billing record belongs to another lead';
    end if;
  end if;
  recipient := coalesce(p_lead_id, billing_lead);
  if not exists (select 1 from public.leads where id = recipient and deleted_at is null) then
    raise exception 'Lead not found';
  end if;
  if p_project_id is null then return; end if;

  select lead_id into project_lead from public.projects
    where id = p_project_id and deleted_at is null for share;
  if not found then raise exception 'Project not found'; end if;
  if project_lead is distinct from recipient then raise exception 'Project belongs to another lead'; end if;
end $$;

-- Preserve the self-service acceptance path for leads with a billing record.
create function public.attach_proposal_billing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is null then
    select id into new.client_id from public.clients
      where lead_id = new.lead_id and deleted_at is null;
  end if;
  return new;
end $$;
revoke all on function public.attach_proposal_billing() from public, anon, authenticated;
create trigger attach_proposal_billing before insert on public.proposals
  for each row execute function public.attach_proposal_billing();

create function public.validate_billable_project() returns trigger
language plpgsql security definer set search_path = '' as $$
declare project_lead uuid;
begin
  if new.project_id is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (new.project_id, new.lead_id) is not distinct from (old.project_id, old.lead_id) then
      return new;
    end if;
  end if;
  select lead_id into project_lead from public.projects where id = new.project_id for share;
  if project_lead is distinct from new.lead_id then
    raise check_violation using message = 'El proyecto no pertenece al lead del documento';
  end if;
  return new;
end $$;
revoke all on function public.validate_billable_project() from public, anon, authenticated;
create trigger validate_billable_project before insert or update of project_id, lead_id, client_id on public.invoices
  for each row execute function public.validate_billable_project();
create trigger validate_billable_project before insert or update of project_id, lead_id, client_id on public.subscriptions
  for each row execute function public.validate_billable_project();

create or replace function public.create_hourly_invoice(
  p_project_id uuid, p_month_start date, p_month_end date, p_month_label text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_series text;
  v_number integer;
  v_invoice_id uuid;
  v_existing_invoice_id uuid;
  v_log_count integer;
  v_linked_log_count integer;
  v_distinct_invoice_count integer;
  v_hours numeric;
  v_updated_count integer;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then
    raise exception 'No autorizado para crear facturas';
  end if;
  if p_month_start is null or p_month_end is null
     or p_month_start <> date_trunc('month', p_month_start)::date
     or p_month_end <> (p_month_start + interval '1 month')::date
     or coalesce(length(btrim(p_month_label)), 0) = 0 then
    raise exception 'Periodo de facturación no válido';
  end if;

  perform pg_advisory_xact_lock(hashtext('hourly-invoice:' || p_project_id::text || ':' || p_month_start::text)::bigint);
  select * into v_project from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then raise exception 'Proyecto no encontrado'; end if;
  if v_project.billing_type <> 'hourly' or coalesce(v_project.hourly_rate, 0) <= 0 then
    raise exception 'El proyecto no tiene facturación por horas válida';
  end if;

  select count(*), count(invoice_id), count(distinct invoice_id), min(invoice_id::text)::uuid, coalesce(sum(hours), 0)
    into v_log_count, v_linked_log_count, v_distinct_invoice_count, v_existing_invoice_id, v_hours
    from public.work_logs
   where project_id = p_project_id and deleted_at is null
     and work_date >= p_month_start and work_date < p_month_end;
  if v_log_count = 0 then raise exception 'No hay horas registradas en ese mes'; end if;
  if v_linked_log_count = v_log_count and v_distinct_invoice_count = 1 then
    perform 1 from public.invoices where id = v_existing_invoice_id and project_id = p_project_id and deleted_at is null;
    if found then return v_existing_invoice_id; end if;
    raise exception 'Las horas ya están vinculadas a una factura no válida';
  end if;
  if v_linked_log_count > 0 then raise exception 'Hay horas del periodo ya facturadas'; end if;

  select * into v_client from public.clients where lead_id = v_project.lead_id and deleted_at is null;
  if not found then raise exception 'Añade los datos de facturación del lead antes de facturar'; end if;
  select coalesce(nullif(trim(invoice_series), ''), 'A') into v_series from public.settings where id = 1;
  if not found then v_series := 'A'; end if;
  perform pg_advisory_xact_lock(hashtext('invoice-series:' || v_series)::bigint);
  select coalesce(max(number), 0) + 1 into v_number from public.invoices where series = v_series;

  insert into public.invoices (
    lead_id, client_id, project_id, series, number, status, currency, subtotal, tax_amount, total,
    client_nif, client_name, client_address_street, client_address_zip, client_address_city,
    client_address_province, client_address_country, created_by
  ) values (
    v_project.lead_id, v_client.id, v_project.id, v_series, v_number, 'draft', 'EUR',
    round(v_hours * v_project.hourly_rate, 2),
    round(v_hours * v_project.hourly_rate * coalesce(v_project.hourly_vat_rate, 0) / 100, 2),
    round(v_hours * v_project.hourly_rate * (1 + coalesce(v_project.hourly_vat_rate, 0) / 100), 2),
    v_client.nif, v_client.name, v_client.billing_address_street, v_client.billing_address_zip,
    v_client.billing_address_city, v_client.billing_address_province, v_client.billing_address_country, auth.uid()
  ) returning id into v_invoice_id;
  insert into public.invoice_items (invoice_id, position, description, quantity, unit_price, vat_rate)
  values (v_invoice_id, 0, 'Horas trabajadas: ' || btrim(p_month_label), v_hours, v_project.hourly_rate, coalesce(v_project.hourly_vat_rate, 0));

  update public.work_logs set invoice_id = v_invoice_id
   where project_id = p_project_id and deleted_at is null and invoice_id is null
     and work_date >= p_month_start and work_date < p_month_end;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_log_count then
    raise exception 'Las horas cambiaron mientras se creaba la factura';
  end if;
  return v_invoice_id;
end $$;

notify pgrst, 'reload schema';