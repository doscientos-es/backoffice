-- Automatic call next steps are reminders, not one new task per attempt.
-- Preserve recorded calls, completed reminders and every manual task.
-- Only redundant OPEN automatic reminders are soft-deleted (recoverable).
set local lock_timeout = '5s';
lock table public.tasks in share row exclusive mode;

with ranked as (
  select id, row_number() over (
    partition by lead_id, assignee_id
    order by created_at desc, id desc
  ) as position
  from public.tasks
  where kind = 'reminder'
    and lead_id is not null and assignee_id is not null
    and status = 'todo' and completed_at is null and deleted_at is null
    and description in ('CALL_PENDING', 'CALL_PENDING_NOTIFIED', 'CALL_AUTO_FOLLOW_UP')
)
update public.tasks t
set deleted_at = now(), status = 'cancelled'
from ranked r
where t.id = r.id and r.position > 1;

-- Older app instances still insert instead of refreshing. Retire the previous
-- slot atomically so those inserts keep returning a row until the app deploys.
create function public.replace_open_automatic_call_reminder()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if new.kind <> 'reminder' or new.lead_id is null or new.assignee_id is null
    or new.status <> 'todo' or new.completed_at is not null or new.deleted_at is not null
    or new.description is null
    or new.description not in ('CALL_PENDING', 'CALL_PENDING_NOTIFIED', 'CALL_AUTO_FOLLOW_UP') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.lead_id::text || ':' || new.assignee_id::text, 0));
  update public.tasks set deleted_at = now(), status = 'cancelled'
  where lead_id = new.lead_id and assignee_id = new.assignee_id
    and kind = 'reminder' and status = 'todo'
    and completed_at is null and deleted_at is null
    and description in ('CALL_PENDING', 'CALL_PENDING_NOTIFIED', 'CALL_AUTO_FOLLOW_UP');
  return new;
end;
$$;

revoke all on function public.replace_open_automatic_call_reminder() from public, anon;
create trigger tasks_replace_open_automatic_call_reminder
before insert on public.tasks
for each row execute function public.replace_open_automatic_call_reminder();

-- CALL_PENDING and its notified variant belong to the same next-step slot.
-- The application refreshes that slot, or closes it when the call is logged.
create unique index tasks_one_open_automatic_call_reminder_idx
  on public.tasks (lead_id, assignee_id)
  where kind = 'reminder'
    and lead_id is not null and assignee_id is not null
    and status = 'todo' and completed_at is null and deleted_at is null
    and description in ('CALL_PENDING', 'CALL_PENDING_NOTIFIED', 'CALL_AUTO_FOLLOW_UP');