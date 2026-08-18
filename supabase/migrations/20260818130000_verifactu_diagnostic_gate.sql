-- A recent, successful synthetic VERI*FACTU run is required before creating
-- real fiscal records. Runs contain only generated test data, never invoices.

create table if not exists public.verifactu_diagnostic_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('passed', 'failed')),
  checks jsonb not null check (jsonb_typeof(checks) = 'array'),
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index if not exists verifactu_diagnostic_runs_latest_idx
  on public.verifactu_diagnostic_runs(created_at desc);

alter table public.verifactu_diagnostic_runs enable row level security;
revoke all on table public.verifactu_diagnostic_runs from public, anon, authenticated;

create policy verifactu_diagnostic_runs_select on public.verifactu_diagnostic_runs
  for select using (public.is_team_member());

create or replace function public.fn_verifactu_diagnostic_runs_immutable()
returns trigger language plpgsql set search_path = public
as $$
begin
  raise exception 'Los diagnósticos VERI*FACTU son append-only.';
end;
$$;

drop trigger if exists trg_verifactu_diagnostic_runs_immutable on public.verifactu_diagnostic_runs;
create trigger trg_verifactu_diagnostic_runs_immutable
  before update or delete on public.verifactu_diagnostic_runs
  for each row execute function public.fn_verifactu_diagnostic_runs_immutable();

create or replace function public.assert_verifactu_diagnostic_gate()
returns void language plpgsql security definer set search_path = public
as $$
declare v_latest public.verifactu_diagnostic_runs%rowtype;
begin
  select * into v_latest from public.verifactu_diagnostic_runs
    order by created_at desc limit 1;
  if not found or v_latest.status <> 'passed' or v_latest.expires_at <= clock_timestamp() then
    raise exception 'La suite sintética VERI*FACTU debe completarse correctamente en Ajustes > Diagnóstico antes de emitir o anular facturas.';
  end if;
end;
$$;

create or replace function public.fn_verifactu_invoice_requires_diagnostic()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.status in ('issued', 'cancelled')
     and new.status is distinct from old.status
     and coalesce(new.verifactu_status::text, '') <> 'excluded' then
    perform public.assert_verifactu_diagnostic_gate();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_verifactu_invoice_requires_diagnostic on public.invoices;
create trigger trg_verifactu_invoice_requires_diagnostic
  before update on public.invoices
  for each row execute function public.fn_verifactu_invoice_requires_diagnostic();

revoke all on function public.assert_verifactu_diagnostic_gate() from public, anon, authenticated;
notify pgrst, 'reload schema';