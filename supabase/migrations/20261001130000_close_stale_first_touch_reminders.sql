-- Close "first contact" reminders of leads that already have a first contact.
-- Covers automatic reminders (marker) and manual ones ("Contactar con ...").
update public.tasks t
set status = 'done',
    completed_at = now()
from public.leads l
where l.id = t.lead_id
  and l.first_contacted_at is not null
  and t.kind = 'reminder'
  and t.status = 'todo'
  and t.completed_at is null
  and t.deleted_at is null
  and (
    t.description = 'AUTO_LEAD_FIRST_TOUCH'
    or (t.description is null and t.title like 'Contactar con %')
  );
