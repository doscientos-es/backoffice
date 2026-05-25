-- ============================================================
-- Tasks, Reminders, Documents, Lead Interactions, Email Templates
-- ============================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority int not null default 0,
  due_date date,
  assigned_to uuid references public.team_members(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  github_issue_url text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists tasks_status_idx on public.tasks(status) where deleted_at is null;
create index if not exists tasks_assigned_idx on public.tasks(assigned_to) where deleted_at is null;

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  remind_at timestamptz not null,
  completed_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders(remind_at) where completed_at is null;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  uploaded_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  type interaction_type not null,
  subject text,
  body text,
  payload jsonb,
  resend_email_id text,
  performed_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lead_interactions_lead_idx on public.lead_interactions(lead_id, created_at desc);
create index if not exists lead_interactions_resend_idx on public.lead_interactions(resend_email_id) where resend_email_id is not null;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subject text not null,
  body_html text not null,
  variables text[] not null default '{}',
  include_signature boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ACTIVITY LOG ----------
create table if not exists public.activity_log (
  id bigserial primary key,
  actor_id uuid references public.team_members(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_entity_idx on public.activity_log(entity_type, entity_id, created_at desc);
