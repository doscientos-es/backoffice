-- Visitor journey attribution for landing interactions.
-- Anonymous events are keyed by visitor_id + event_id and linked to a lead once
-- the visitor converts through the contact form or a tracked WhatsApp click.

ALTER TABLE public.conversion_events
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversion_events_visitor_idx
  ON public.conversion_events (visitor_id, created_at DESC)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversion_events_lead_idx
  ON public.conversion_events (lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;

UPDATE public.conversion_events ce
SET lead_id = l.id
FROM public.leads l
WHERE ce.lead_id IS NULL
  AND ce.event_id IS NOT NULL
  AND l.event_id = ce.event_id
  AND l.deleted_at IS NULL;
