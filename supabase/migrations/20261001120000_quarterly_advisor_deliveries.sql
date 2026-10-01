-- ============================================================
-- Append-only log of quarterly registers sent to the tax advisor
-- (fiscal@doscientos.es). Drives the finance reminder: a quarter
-- with a non-mocked delivery is considered handed off.
-- ============================================================

create table if not exists public.quarterly_advisor_deliveries (
  id                  uuid        primary key default gen_random_uuid(),
  year                integer     not null check (year between 2000 and 2100),
  quarter             smallint    not null check (quarter between 1 and 4),
  recipient           text        not null,
  invoice_count       integer     not null default 0,
  expense_count       integer     not null default 0,
  attached_pdfs       integer     not null default 0,
  -- Resend message id, null for mocked sends.
  provider_message_id text,
  -- True when Resend is not configured and the email was only simulated.
  mocked              boolean     not null default false,
  sent_by             uuid        references public.team_members(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists quarterly_advisor_deliveries_period_idx
  on public.quarterly_advisor_deliveries(year desc, quarter desc, created_at desc);

-- ---- RLS ----
alter table public.quarterly_advisor_deliveries enable row level security;

drop policy if exists quarterly_advisor_deliveries_select on public.quarterly_advisor_deliveries;
create policy quarterly_advisor_deliveries_select on public.quarterly_advisor_deliveries
  for select using (public.current_member_role() in ('owner', 'admin'));

drop policy if exists quarterly_advisor_deliveries_insert on public.quarterly_advisor_deliveries;
create policy quarterly_advisor_deliveries_insert on public.quarterly_advisor_deliveries
  for insert with check (
    public.current_member_role() in ('owner', 'admin')
    and sent_by = auth.uid()
  );

drop policy if exists quarterly_advisor_deliveries_no_update on public.quarterly_advisor_deliveries;
create policy quarterly_advisor_deliveries_no_update on public.quarterly_advisor_deliveries
  for update using (false);

drop policy if exists quarterly_advisor_deliveries_no_delete on public.quarterly_advisor_deliveries;
create policy quarterly_advisor_deliveries_no_delete on public.quarterly_advisor_deliveries
  for delete using (false);
