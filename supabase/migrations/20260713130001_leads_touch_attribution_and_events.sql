-- Close the landing -> CRM attribution loop.
-- Leads keep first/last touch fields for sales context; conversion_events keeps
-- anonymous pre-lead events such as WhatsApp clicks.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS event_id              text,
  ADD COLUMN IF NOT EXISTS conversion_step       text,
  ADD COLUMN IF NOT EXISTS first_landing_path    text,
  ADD COLUMN IF NOT EXISTS first_referrer        text,
  ADD COLUMN IF NOT EXISTS first_utm_source      text,
  ADD COLUMN IF NOT EXISTS first_utm_medium      text,
  ADD COLUMN IF NOT EXISTS first_utm_campaign    text,
  ADD COLUMN IF NOT EXISTS first_utm_term        text,
  ADD COLUMN IF NOT EXISTS first_utm_content     text,
  ADD COLUMN IF NOT EXISTS last_landing_path     text,
  ADD COLUMN IF NOT EXISTS last_referrer         text,
  ADD COLUMN IF NOT EXISTS last_utm_source       text,
  ADD COLUMN IF NOT EXISTS last_utm_medium       text,
  ADD COLUMN IF NOT EXISTS last_utm_campaign     text,
  ADD COLUMN IF NOT EXISTS last_utm_term         text,
  ADD COLUMN IF NOT EXISTS last_utm_content      text;

CREATE INDEX IF NOT EXISTS leads_event_id_idx
  ON public.leads (event_id)
  WHERE deleted_at IS NULL AND event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_conversion_step_idx
  ON public.leads (conversion_step)
  WHERE deleted_at IS NULL AND conversion_step IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.conversion_events (
  id bigserial PRIMARY KEY,
  event_id text,
  event_name text NOT NULL,
  conversion_step text,
  landing_path text,
  landing_ref text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  ip text,
  user_agent text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS conversion_events_event_idx
  ON public.conversion_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS conversion_events_event_id_idx
  ON public.conversion_events (event_id)
  WHERE event_id IS NOT NULL;

-- Backfill canonical values from the older landing/backoffice contract.
UPDATE public.leads
SET
  source = CASE
    WHEN lower(source) IN ('landing', 'landing_form') THEN 'Landing'
    WHEN lower(source) IN ('cal.com', 'cal') THEN 'Cal.com'
    WHEN lower(source) IN ('meta', 'meta_lead_ads', 'anuncios meta') THEN 'Anuncios Meta'
    ELSE source
  END,
  company_size = CASE
    WHEN company_size IN ('1-10', '1–10') THEN '1-10 empleados'
    WHEN company_size IN ('10-50', '10–50') THEN '10-50 empleados'
    WHEN company_size IN ('50-200', '50–200') THEN '50-200 empleados'
    WHEN company_size IN ('200+', '+200') THEN 'Más de 200 empleados'
    ELSE company_size
  END,
  urgency = CASE
    WHEN lower(urgency) IN ('sin urgencia', 'solo informacion', 'solo información') THEN 'Explorando'
    ELSE urgency
  END,
  first_landing_path = COALESCE(first_landing_path, landing_path),
  last_landing_path = COALESCE(last_landing_path, landing_path),
  first_referrer = COALESCE(first_referrer, referrer),
  last_referrer = COALESCE(last_referrer, referrer),
  first_utm_source = COALESCE(first_utm_source, utm_source),
  first_utm_medium = COALESCE(first_utm_medium, utm_medium),
  first_utm_campaign = COALESCE(first_utm_campaign, utm_campaign),
  first_utm_term = COALESCE(first_utm_term, utm_term),
  first_utm_content = COALESCE(first_utm_content, utm_content),
  last_utm_source = COALESCE(last_utm_source, utm_source),
  last_utm_medium = COALESCE(last_utm_medium, utm_medium),
  last_utm_campaign = COALESCE(last_utm_campaign, utm_campaign),
  last_utm_term = COALESCE(last_utm_term, utm_term),
  last_utm_content = COALESCE(last_utm_content, utm_content)
WHERE deleted_at IS NULL;
