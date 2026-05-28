-- ============================================================
-- Proposals · billing_cycle per item
-- ------------------------------------------------------------
-- Adds a per-line billing cadence to proposal_items, reusing the
-- expense_recurrence enum (none | monthly | quarterly | yearly).
--
-- Existing rows default to 'none' so legacy proposals keep their
-- one-time semantics. Invoices are unaffected: the field lives
-- only on the proposal side and is dropped when items are cloned
-- into invoice_items.
-- ============================================================

alter table public.proposal_items
  add column if not exists billing_cycle expense_recurrence not null default 'none';

create index if not exists proposal_items_billing_cycle_idx
  on public.proposal_items(proposal_id, billing_cycle);
