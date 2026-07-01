DO $$
DECLARE
  old_id uuid := '31173bd0-76aa-4025-87ad-01c63fcf2a32';
  new_id uuid := '5e529d59-3406-4413-9705-e3a91f356503';
BEGIN
  UPDATE public.team_members SET
    name               = (SELECT name            FROM public.team_members WHERE id = old_id),
    role               = (SELECT role            FROM public.team_members WHERE id = old_id),
    avatar_url         = (SELECT avatar_url      FROM public.team_members WHERE id = old_id),
    email_alias        = (SELECT email_alias     FROM public.team_members WHERE id = old_id),
    signature_html     = (SELECT signature_html  FROM public.team_members WHERE id = old_id),
    email_send_enabled = (SELECT email_send_enabled FROM public.team_members WHERE id = old_id),
    github_handle      = (SELECT github_handle   FROM public.team_members WHERE id = old_id),
    onboarded_at       = (SELECT onboarded_at    FROM public.team_members WHERE id = old_id),
    job_title          = (SELECT job_title       FROM public.team_members WHERE id = old_id),
    phone              = (SELECT phone           FROM public.team_members WHERE id = old_id),
    contact_email      = (SELECT contact_email   FROM public.team_members WHERE id = old_id),
    calendar_token     = (SELECT calendar_token  FROM public.team_members WHERE id = old_id),
    updated_at         = now()
  WHERE id = new_id;

  UPDATE public.activity_log             SET actor_id          = new_id WHERE actor_id          = old_id;
  UPDATE public.attachments              SET uploaded_by        = new_id WHERE uploaded_by        = old_id;
  UPDATE public.email_templates          SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.expenses                 SET paid_by_member_id  = new_id WHERE paid_by_member_id  = old_id;
  UPDATE public.expenses                 SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.internal_document_events SET actor_id          = new_id WHERE actor_id          = old_id;
  UPDATE public.internal_documents       SET uploaded_by        = new_id WHERE uploaded_by        = old_id;
  UPDATE public.invoices                 SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.lead_interactions        SET performed_by       = new_id WHERE performed_by       = old_id;
  UPDATE public.leads                    SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.leads                    SET updated_by         = new_id WHERE updated_by         = old_id;
  UPDATE public.leads                    SET assigned_to        = new_id WHERE assigned_to        = old_id;
  UPDATE public.notification_preferences SET member_id          = new_id WHERE member_id          = old_id;
  UPDATE public.notifications            SET recipient_id       = new_id WHERE recipient_id       = old_id;
  UPDATE public.notifications            SET actor_id           = new_id WHERE actor_id           = old_id;
  UPDATE public.proposal_specs           SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.proposal_view_events     SET team_member_id     = new_id WHERE team_member_id     = old_id;
  UPDATE public.proposals                SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.reminders                SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.subscriptions            SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.task_comments            SET author_id          = new_id WHERE author_id          = old_id;
  UPDATE public.tasks                    SET assignee_id        = new_id WHERE assignee_id        = old_id;
  UPDATE public.tasks                    SET created_by         = new_id WHERE created_by         = old_id;
  UPDATE public.work_logs                SET member_id          = new_id WHERE member_id          = old_id;

  DELETE FROM public.team_members WHERE id = old_id;
  DELETE FROM auth.users          WHERE id = old_id;
END $$;
