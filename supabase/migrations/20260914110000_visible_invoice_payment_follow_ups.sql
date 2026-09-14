-- Visible, cancellable invoice payment follow-ups.
-- A row represents an intended email, not an implicit side effect. The UI shows
-- pending rows and the cron only claims rows in status=pending.

create table if not exists public.invoice_automations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  kind text not null check (kind in ('payment_follow_up')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'cancelled', 'skipped', 'failed')),
  run_at timestamptz not null,
  recipient text not null,
  subject text not null,
  message text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  cancelled_at timestamptz,
  provider_message_id text,
  last_error text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, kind)
);

create index if not exists invoice_automations_due_idx
  on public.invoice_automations (run_at)
  where status = 'pending';

create index if not exists invoice_automations_invoice_idx
  on public.invoice_automations (invoice_id, created_at desc);

alter table public.invoice_automations enable row level security;

drop policy if exists invoice_automations_select on public.invoice_automations;
create policy invoice_automations_select on public.invoice_automations
  for select using (public.is_team_member());

drop policy if exists invoice_automations_insert on public.invoice_automations;
create policy invoice_automations_insert on public.invoice_automations
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists invoice_automations_update on public.invoice_automations;
create policy invoice_automations_update on public.invoice_automations
  for update using (public.current_member_role() in ('owner', 'admin', 'member'))
  with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists invoice_automations_delete on public.invoice_automations;
create policy invoice_automations_delete on public.invoice_automations
  for delete using (public.current_member_role() in ('owner', 'admin', 'member'));