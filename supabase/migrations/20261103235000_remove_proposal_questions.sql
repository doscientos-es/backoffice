-- Retire internal proposal conversations in favor of the company WhatsApp link.
-- Deliberately do not use CASCADE: unexpected dependencies must abort the migration.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Stop rather than discard a conversation created since the inventory check.
lock table public.proposal_messages in access exclusive mode;
do $$
begin
  if exists (select 1 from public.proposal_messages) then
    raise exception 'proposal_messages contains conversations; review them before removal';
  end if;
end $$;
drop table public.proposal_messages;

delete from public.notifications where event_type = 'proposal_question';
delete from public.notification_preferences where event_type = 'proposal_question';

-- Remove retired signals from the cached scores only for affected leads.
-- Historical temperature decisions remain unchanged.
update public.leads as lead
set engagement_score = least(100, (
      select coalesce(sum(event.points), 0)
      from public.proposal_engagement_events as event
      where event.lead_id = lead.id
        and event.event_type <> 'question_sent'
        and event.created_at >= now() - interval '14 days'
    )),
    last_engaged_at = (
      select max(event.created_at)
      from public.proposal_engagement_events as event
      where event.lead_id = lead.id
        and event.event_type <> 'question_sent'
    )
where exists (
  select 1 from public.proposal_engagement_events as event
  where event.lead_id = lead.id and event.event_type = 'question_sent'
);

delete from public.proposal_engagement_events where event_type = 'question_sent';

alter table public.proposal_engagement_events
  drop constraint proposal_engagement_events_event_type_check;
alter table public.proposal_engagement_events
  add constraint proposal_engagement_events_event_type_check check (event_type in (
    'return_visit', 'pricing_viewed', 'terms_viewed', 'pdf_download',
    'deck_completed', 'whatsapp_click', 'maintenance_selected', 'sign_form_opened'
  ));

notify pgrst, 'reload schema';