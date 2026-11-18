-- The filename matches the version assigned by Supabase Management API.
alter table public.leads
  add column abaco_interest boolean not null default false;

comment on column public.leads.abaco_interest is
  'Oportunidad comercial de Ábaco. No indica que exista una suscripción o un cobro.';

create index leads_abaco_interest_idx on public.leads (created_at desc)
  where abaco_interest and deleted_at is null;

alter table public.invoices
  add column billing_source text not null default 'backoffice'
    check (billing_source in ('backoffice', 'abaco_subscription'));

comment on column public.invoices.billing_source is
  'Origen de la factura, independiente del cliente y de su serie fiscal.';

create index invoices_billing_source_issue_date_idx on public.invoices (billing_source, issue_date desc)
  where deleted_at is null;