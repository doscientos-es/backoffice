-- Restore the email template schema that remains part of the active product.
-- A prior cleanup migration removed it, while production later restored it
-- outside the migration chain. Keeping this idempotent makes fresh/demo
-- rebuilds converge to the same public schema as production.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  include_signature boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_select ON public.email_templates;
CREATE POLICY email_templates_select ON public.email_templates
  FOR SELECT USING (public.is_team_member());

DROP POLICY IF EXISTS email_templates_insert ON public.email_templates;
CREATE POLICY email_templates_insert ON public.email_templates
  FOR INSERT WITH CHECK (public.current_member_role() IN ('owner', 'admin', 'member'));

DROP POLICY IF EXISTS email_templates_update ON public.email_templates;
CREATE POLICY email_templates_update ON public.email_templates
  FOR UPDATE USING (public.current_member_role() IN ('owner', 'admin', 'member'));

DROP POLICY IF EXISTS email_templates_delete ON public.email_templates;
CREATE POLICY email_templates_delete ON public.email_templates
  FOR DELETE USING (public.current_member_role() IN ('owner', 'admin'));

DROP TRIGGER IF EXISTS trg_touch_email_templates ON public.email_templates;
CREATE TRIGGER trg_touch_email_templates
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();