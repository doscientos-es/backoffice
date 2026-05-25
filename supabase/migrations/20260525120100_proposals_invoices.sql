-- ============================================================
-- Proposals + Invoices (Verifactu/SIF compliant)
-- ============================================================

-- ---------- PROPOSALS ----------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  number text not null unique,
  title text not null,
  status proposal_status not null default 'draft',
  currency text not null default 'EUR',
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_until date,
  portal_token text unique default encode(gen_random_bytes(24), 'hex'),
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  signature_data jsonb,
  notes text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists proposals_client_idx on public.proposals(client_id) where deleted_at is null;
create index if not exists proposals_status_idx on public.proposals(status) where deleted_at is null;

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null,
  vat_rate numeric(5,2) not null default 21.00,
  subtotal numeric(12,2) generated always as (quantity * unit_price) stored
);
create index if not exists proposal_items_proposal_idx on public.proposal_items(proposal_id);

-- ---------- INVOICES (Verifactu/SIF) ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,

  -- Fiscal identifiers
  series text not null default 'A',
  number int not null,
  full_number text generated always as (series || '-' || lpad(number::text, 6, '0')) stored,
  invoice_type invoice_type not null default 'F1',
  idfact text,                                  -- NIF-FULLNUMBER-YYYYMMDD

  -- Dates
  issue_date date not null default current_date,
  issued_at timestamptz,                        -- exact emission timestamp (fed into hash)
  due_date date,

  status invoice_status not null default 'draft',
  currency text not null default 'EUR',
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  -- Client snapshot (immutable once issued)
  client_nif text,
  client_name text,
  client_address text,

  -- Verifactu hash chain (Anexo I, Orden HAC/1177/2024)
  previous_hash text,
  current_hash text,
  chain_sequence bigint,
  hash_generated_at timestamptz,
  verifactu_status verifactu_status not null default 'pending',
  verifactu_submitted_at timestamptz,
  verifactu_csv text,
  verifactu_response jsonb,
  qr_url text,

  notes text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (series, number)
);
create index if not exists invoices_client_idx on public.invoices(client_id) where deleted_at is null;
create index if not exists invoices_status_idx on public.invoices(status) where deleted_at is null;
create index if not exists invoices_chain_idx on public.invoices(chain_sequence) where verifactu_status <> 'excluded';

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null,
  vat_rate numeric(5,2) not null default 21.00,
  subtotal numeric(12,2) generated always as (quantity * unit_price) stored
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- ---------- IMMUTABILITY TRIGGER (Verifactu) ----------
create or replace function public.fn_invoice_immutable()
returns trigger as $$
begin
  if OLD.verifactu_status = 'excluded' then
    return NEW;
  end if;
  if (
    NEW.series           is distinct from OLD.series           or
    NEW.number           is distinct from OLD.number           or
    NEW.invoice_type     is distinct from OLD.invoice_type     or
    NEW.idfact           is distinct from OLD.idfact           or
    NEW.issue_date       is distinct from OLD.issue_date       or
    NEW.issued_at        is distinct from OLD.issued_at        or
    NEW.client_nif       is distinct from OLD.client_nif       or
    NEW.client_name      is distinct from OLD.client_name      or
    NEW.client_address   is distinct from OLD.client_address   or
    NEW.subtotal         is distinct from OLD.subtotal         or
    NEW.tax_amount       is distinct from OLD.tax_amount       or
    NEW.total            is distinct from OLD.total            or
    NEW.previous_hash    is distinct from OLD.previous_hash    or
    NEW.current_hash     is distinct from OLD.current_hash     or
    NEW.chain_sequence   is distinct from OLD.chain_sequence
  ) then
    raise exception 'Fiscal fields of invoice % are immutable (Verifactu RD 1007/2023). Issue a rectificativa instead.', OLD.full_number;
  end if;
  return NEW;
end $$ language plpgsql;

drop trigger if exists trg_invoice_immutable on public.invoices;
create trigger trg_invoice_immutable
  before update on public.invoices
  for each row when (OLD.verifactu_status <> 'excluded' and OLD.status <> 'draft')
  execute function public.fn_invoice_immutable();

create or replace function public.fn_invoice_items_immutable()
returns trigger as $$
declare v_status invoice_status; v_vstatus verifactu_status;
begin
  select status, verifactu_status into v_status, v_vstatus
  from public.invoices where id = coalesce(NEW.invoice_id, OLD.invoice_id);
  if v_vstatus = 'excluded' or v_status = 'draft' then return coalesce(NEW, OLD); end if;
  raise exception 'Invoice items are immutable once the invoice is issued (Verifactu).';
end $$ language plpgsql;

drop trigger if exists trg_invoice_items_immutable on public.invoice_items;
create trigger trg_invoice_items_immutable
  before update or delete on public.invoice_items
  for each row execute function public.fn_invoice_items_immutable();
