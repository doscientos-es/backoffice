-- ============================================================
-- Audit trail for internal_documents.
-- Append-only log of actions performed on internal company docs
-- (created / metadata updated / file replaced / deleted) so admins
-- and editors can trace who changed what and when.
-- ============================================================

create table if not exists public.internal_document_events (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.internal_documents(id) on delete cascade,
  action       text not null
               check (action in ('created', 'updated', 'file_replaced', 'deleted')),
  actor_id     uuid references public.team_members(id) on delete set null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists internal_document_events_doc_idx
  on public.internal_document_events(document_id, created_at desc);

-- ---- RLS ----
alter table public.internal_document_events enable row level security;

-- Read events only for documents the member is allowed to see. Mirrors the
-- visibility rule of internal_documents (admins_only → owner/admin only).
drop policy if exists internal_document_events_select on public.internal_document_events;
create policy internal_document_events_select on public.internal_document_events
  for select using (
    public.is_team_member()
    and exists (
      select 1 from public.internal_documents d
      where d.id = document_id
        and (
          d.visibility = 'all_team'
          or public.current_member_role() in ('owner', 'admin')
        )
    )
  );

drop policy if exists internal_document_events_insert on public.internal_document_events;
create policy internal_document_events_insert on public.internal_document_events
  for insert with check (
    public.current_member_role() in ('owner', 'admin', 'member')
  );

-- Append-only: events are immutable once written.
drop policy if exists internal_document_events_no_update on public.internal_document_events;
create policy internal_document_events_no_update on public.internal_document_events
  for update using (false);

drop policy if exists internal_document_events_no_delete on public.internal_document_events;
create policy internal_document_events_no_delete on public.internal_document_events
  for delete using (false);
