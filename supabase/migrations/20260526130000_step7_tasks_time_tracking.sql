-- ============================================================
-- Step 7 — Tasks & time tracking
-- Aligned with docs/description.md §5.18–§5.24 and §18.5
-- ============================================================

-- ---------- MILESTONES ----------
-- Merged definition of §5.4 (project_milestones) + §5.21 (ampliada).
create table if not exists public.milestones (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references public.projects(id) on delete cascade,
  name                   text not null,
  description            text,
  percentage             numeric(5,2),
  amount                 numeric(10,2),
  start_date             date,
  due_date               date,
  completed_at           timestamptz,
  completion_percentage  int not null default 0 check (completion_percentage between 0 and 100),
  color                  text not null default '#6366f1',
  github_milestone_number int,
  is_payment_milestone   bool not null default false,
  status                 text not null default 'pending',
  -- 'pending' | 'invoiced' | 'paid' | 'completed' | 'cancelled'
  invoice_id             uuid references public.invoices(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_milestones_project on public.milestones(project_id);
create index if not exists idx_milestones_status  on public.milestones(status);

-- ---------- TASKS (refactor to spec) ----------
-- The current production tasks table has 0 rows, so we drop & recreate to align
-- column names and types (status text, priority text, assignee_id, etc.).
drop trigger if exists trg_touch_tasks on public.tasks;
drop table  if exists public.tasks cascade;

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  project_id          uuid references public.projects(id)       on delete cascade,
  lead_id             uuid references public.leads(id)          on delete cascade,
  milestone_id        uuid references public.milestones(id)     on delete set null,
  parent_task_id      uuid references public.tasks(id)          on delete cascade,
  assignee_id         uuid references public.team_members(id)   on delete set null,
  created_by          uuid references public.team_members(id)   on delete set null,

  constraint tasks_context_check check (project_id is not null or lead_id is not null),

  title               text not null,
  description         text,
  status              text not null default 'todo'
    check (status in ('todo','in_progress','in_review','done','cancelled')),
  priority            text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),

  due_date            date,
  started_at          timestamptz,
  completed_at        timestamptz,
  estimated_hours     numeric(6,2),

  kanban_order        text not null default 'a0',

  github_issue_number int,
  github_issue_url    text,
  github_pr_number    int,
  github_pr_url       text,
  github_synced_at    timestamptz,

  is_billable         bool not null default true,
  deleted_at          timestamptz
);
create index if not exists idx_tasks_project_id      on public.tasks(project_id)      where project_id is not null;
create index if not exists idx_tasks_lead_id         on public.tasks(lead_id)         where lead_id is not null;
create index if not exists idx_tasks_assignee_id     on public.tasks(assignee_id);
create index if not exists idx_tasks_parent_task_id  on public.tasks(parent_task_id);
create index if not exists idx_tasks_status          on public.tasks(status);
create index if not exists idx_tasks_kanban          on public.tasks(project_id, status, kanban_order);
create index if not exists idx_tasks_github_issue    on public.tasks(github_issue_number) where github_issue_number is not null;

-- ---------- TASK COMMENTS ----------
create table if not exists public.task_comments (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  task_id           uuid not null references public.tasks(id) on delete cascade,
  author_id         uuid not null references public.team_members(id) on delete restrict,
  body              text not null,
  mentions          uuid[] not null default '{}',
  edited            bool not null default false,
  source            text not null default 'crm' check (source in ('crm','github')),
  github_comment_id bigint
);
create index if not exists idx_task_comments_task on public.task_comments(task_id);

-- ---------- TASK TAGS ----------
create table if not exists public.task_tags (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.task_tag_assignments (
  task_id uuid not null references public.tasks(id)     on delete cascade,
  tag_id  uuid not null references public.task_tags(id) on delete cascade,
  primary key (task_id, tag_id)
);
create index if not exists idx_tag_assignments_task on public.task_tag_assignments(task_id);
create index if not exists idx_tag_assignments_tag  on public.task_tag_assignments(tag_id);

-- ---------- TIME ENTRIES ----------
create table if not exists public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  task_id          uuid references public.tasks(id)        on delete set null,
  project_id       uuid not null references public.projects(id) on delete cascade,
  member_id        uuid not null references public.team_members(id) on delete cascade,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  duration_minutes int generated always as (
    case when ended_at is not null
         then (extract(epoch from (ended_at - started_at)) / 60)::int
         else null
    end
  ) stored,
  description      text,
  is_billable      bool not null default true,
  hourly_rate      numeric(10,2),
  invoiced_at      timestamptz,
  invoice_id       uuid references public.invoices(id) on delete set null,
  constraint time_entries_range_check check (ended_at is null or ended_at > started_at)
);
create index if not exists idx_time_entries_project    on public.time_entries(project_id);
create index if not exists idx_time_entries_member     on public.time_entries(member_id);
create index if not exists idx_time_entries_task       on public.time_entries(task_id) where task_id is not null;
create index if not exists idx_time_entries_uninvoiced on public.time_entries(project_id, is_billable)
  where invoiced_at is null and ended_at is not null;

-- One active timer per member (ended_at IS NULL).
create unique index if not exists time_entries_one_active_per_member
  on public.time_entries(member_id) where ended_at is null;

-- ---------- NOTIFICATION PREFERENCES ----------
create table if not exists public.notification_preferences (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.team_members(id) on delete cascade,
  event_type text not null,
  channel    text not null check (channel in ('email','in_app')),
  enabled    bool not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, event_type, channel)
);
create index if not exists idx_notif_prefs_member on public.notification_preferences(member_id);


-- ---------- TRIGGERS: updated_at touch ----------
do $$ declare t text;
begin
  foreach t in array array[
    'milestones','tasks','task_comments','task_tags',
    'time_entries','notification_preferences'
  ] loop
    execute format('drop trigger if exists trg_touch_%s on public.%s', t, t);
    execute format(
      'create trigger trg_touch_%s before update on public.%s for each row execute function public.fn_touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------- TRIGGER: milestone progress (§18.5) ----------
create or replace function public.update_milestone_progress()
returns trigger language plpgsql as $$
declare
  total_tasks int;
  done_tasks  int;
  target_id   uuid;
begin
  target_id := coalesce(new.milestone_id, old.milestone_id);
  if target_id is null then return coalesce(new, old); end if;

  select count(*), count(*) filter (where status = 'done')
    into total_tasks, done_tasks
    from public.tasks
   where milestone_id = target_id
     and status <> 'cancelled'
     and deleted_at is null;

  update public.milestones
     set completion_percentage = case when total_tasks = 0 then 0
                                      else round((done_tasks::numeric / total_tasks) * 100)::int
                                 end,
         status = case when total_tasks > 0 and done_tasks = total_tasks
                       and status not in ('invoiced','paid','cancelled')
                       then 'completed'
                       else status
                  end,
         completed_at = case when total_tasks > 0 and done_tasks = total_tasks
                              and completed_at is null
                              then now()
                              else completed_at
                         end
   where id = target_id;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_milestone_progress on public.tasks;
create trigger trg_milestone_progress
  after insert or update of status, milestone_id, deleted_at or delete on public.tasks
  for each row execute function public.update_milestone_progress();

-- ---------- RLS ----------
alter table public.milestones               enable row level security;
alter table public.tasks                    enable row level security;
alter table public.task_comments            enable row level security;
alter table public.task_tags                enable row level security;
alter table public.task_tag_assignments     enable row level security;
alter table public.time_entries             enable row level security;
alter table public.notification_preferences enable row level security;

-- Tasks: team reads all; member+ writes; owner/admin deletes.
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select using (public.is_team_member());
drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert
  with check (public.current_member_role() in ('owner','admin','member'));
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update
  using (public.current_member_role() in ('owner','admin','member'));
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks for delete
  using (public.current_member_role() in ('owner','admin'));

-- Milestones, task_comments, task_tags, task_tag_assignments: team reads; member+ writes.
do $$ declare t text;
begin
  foreach t in array array[
    'milestones','task_comments','task_tags','task_tag_assignments'
  ] loop
    execute format('drop policy if exists "%s_select" on public.%s', t, t);
    execute format('create policy "%s_select" on public.%s for select using (public.is_team_member())', t, t);

    execute format('drop policy if exists "%s_insert" on public.%s', t, t);
    execute format('create policy "%s_insert" on public.%s for insert with check (public.current_member_role() in (''owner'',''admin'',''member''))', t, t);

    execute format('drop policy if exists "%s_update" on public.%s', t, t);
    execute format('create policy "%s_update" on public.%s for update using (public.current_member_role() in (''owner'',''admin'',''member''))', t, t);

    execute format('drop policy if exists "%s_delete" on public.%s', t, t);
    execute format('create policy "%s_delete" on public.%s for delete using (public.current_member_role() in (''owner'',''admin'',''member''))', t, t);
  end loop;
end $$;

-- time_entries: each member sees/edits their own; admin+ sees all.
drop policy if exists "time_entries_select" on public.time_entries;
create policy "time_entries_select" on public.time_entries for select
  using (member_id = auth.uid() or public.current_member_role() in ('owner','admin'));

drop policy if exists "time_entries_insert" on public.time_entries;
create policy "time_entries_insert" on public.time_entries for insert
  with check (member_id = auth.uid()
              and public.current_member_role() in ('owner','admin','member'));

drop policy if exists "time_entries_update" on public.time_entries;
create policy "time_entries_update" on public.time_entries for update
  using (member_id = auth.uid() or public.current_member_role() in ('owner','admin'));

drop policy if exists "time_entries_delete" on public.time_entries;
create policy "time_entries_delete" on public.time_entries for delete
  using (member_id = auth.uid() or public.current_member_role() in ('owner','admin'));

-- notification_preferences: each member manages their own.
drop policy if exists "notif_prefs_all" on public.notification_preferences;
create policy "notif_prefs_all" on public.notification_preferences for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ---------- Drop legacy enum if no longer referenced ----------
do $$ begin
  drop type if exists public.task_status;
exception when dependent_objects_still_exist then null; end $$;
