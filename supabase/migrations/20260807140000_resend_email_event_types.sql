-- Registrar todos los eventos de email de Resend en el historial CRM.
-- El identificador Svix hace que los reintentos del proveedor sean idempotentes.

ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_scheduled';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_delivery_delayed';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_failed';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'email_suppressed';

ALTER TABLE public.lead_interactions
  ADD COLUMN IF NOT EXISTS resend_webhook_id text;

DO $$
BEGIN
  ALTER TABLE public.lead_interactions
    ADD CONSTRAINT lead_interactions_resend_webhook_id_key UNIQUE (resend_webhook_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;