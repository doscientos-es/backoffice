-- ============================================================
-- Append-only log of invoice deliveries to the client.
-- Records every time the portal link is emailed or shared over
-- WhatsApp so the team can tell whether (and when) a client was
-- already notified, and diagnose delivery problems afterwards.
-- ============================================================

create table if not exists public.invoice_deliveries (
  id                  uuid        primary key default gen_random_uuid(),
  invoice_id          uuid        not null references public.invoices(id) on delete cascade,
  channel             text        not null check (channel in ('email', 'whatsapp')),
  -- Email address or phone number the link was sent to.
  recipient           text,
  attached_pdf        boolean     not null default false,
  -- Resend message id, null for WhatsApp shares and mocked sends.
  provider_message_id text,
  -- True when Resend is not configured and the email was only simulated.
  mocked              boolean     not null default false,
  sent_by             uuid        references public.team_members(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists invoice_deliveries_invoice_idx
  on public.invoice_deliveries(invoice_id, created_at desc);

-- ---- RLS ----
alter table public.invoice_deliveries enable row level security;

drop policy if exists invoice_deliveries_select on public.invoice_deliveries;
create policy invoice_deliveries_select on public.invoice_deliveries
  for select using (public.is_team_member());

drop policy if exists invoice_deliveries_insert on public.invoice_deliveries;
create policy invoice_deliveries_insert on public.invoice_deliveries
  for insert with check (
    public.current_member_role() in ('owner', 'admin', 'member')
    and sent_by = auth.uid()
  );

-- Append-only: deliveries are immutable evidence of what the client received.
drop policy if exists invoice_deliveries_no_update on public.invoice_deliveries;
create policy invoice_deliveries_no_update on public.invoice_deliveries
  for update using (false);

drop policy if exists invoice_deliveries_no_delete on public.invoice_deliveries;
create policy invoice_deliveries_no_delete on public.invoice_deliveries
  for delete using (false);
