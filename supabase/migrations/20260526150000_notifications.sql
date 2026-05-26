-- ============================================================
-- In-app notifications
-- ============================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  recipient_id uuid not null references public.team_members(id) on delete cascade,
  actor_id     uuid          references public.team_members(id) on delete set null,
  event_type   text not null,   -- 'task_comment' | 'task_mention' | 'task_assigned'
  entity_type  text not null,   -- 'task'
  entity_id    uuid not null,
  body         text,
  link         text,
  read_at      timestamptz      -- null = unread
);

create index if not exists idx_notifications_recipient
  on public.notifications(recipient_id, read_at)
  where read_at is null;

-- RLS: each member sees/marks their own notifications
alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select
  using (recipient_id = auth.uid());

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert
  with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update
  using (recipient_id = auth.uid());

drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications for delete
  using (recipient_id = auth.uid());
