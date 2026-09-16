-- Payment follow-ups must be anchored to a real client delivery, never to the
-- date on which an invoice draft was created. Repair rows created by the old
-- issuance-time scheduling and discard rows for invoices never delivered.

with first_delivery as (
  select distinct on (invoice_id)
    invoice_id,
    created_at
  from public.invoice_deliveries
  order by invoice_id, created_at asc
), pending_follow_ups as (
  select
    automation.id,
    first_delivery.created_at as delivered_at
  from public.invoice_automations automation
  join public.invoices invoice on invoice.id = automation.invoice_id
  join first_delivery on first_delivery.invoice_id = invoice.id
  where automation.kind = 'payment_follow_up'
    and automation.status in ('pending', 'failed')
)
update public.invoice_automations automation
set run_at = greatest(pending_follow_ups.delivered_at + interval '4 days', clock_timestamp()),
    updated_at = clock_timestamp(),
    last_error = null
from pending_follow_ups
where automation.id = pending_follow_ups.id;

update public.invoice_automations automation
set status = 'cancelled',
    cancelled_at = coalesce(automation.cancelled_at, clock_timestamp()),
    updated_at = clock_timestamp(),
    last_error = 'No se envió la factura al cliente'
where automation.kind = 'payment_follow_up'
  and automation.status in ('pending', 'failed')
  and not exists (
    select 1
    from public.invoice_deliveries delivery
    where delivery.invoice_id = automation.invoice_id
  );