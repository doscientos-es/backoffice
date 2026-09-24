-- Durable discovery questions and evidence-backed answers for lead qualification.
create table if not exists public.lead_discovery_questions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 3 and 500),
  category text not null default 'other',
  rationale text not null default '',
  priority smallint not null default 2 check (priority between 1 and 3),
  status text not null default 'open'
    check (status in ('open', 'answered', 'needs_review', 'deferred', 'not_applicable', 'archived')),
  answer text,
  suggested_answer text,
  answer_source text check (answer_source in ('manual', 'ai')),
  source_interaction_id uuid references public.lead_interactions(id) on delete set null,
  evidence_excerpt text,
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  origin text not null default 'manual' check (origin in ('manual', 'ai')),
  sort_order integer not null default 0,
  created_by uuid references public.team_members(id) on delete set null,
  updated_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_discovery_questions_lead_status_idx
  on public.lead_discovery_questions(lead_id, status, priority, sort_order, created_at);
create index if not exists lead_discovery_questions_source_interaction_idx
  on public.lead_discovery_questions(source_interaction_id)
  where source_interaction_id is not null;

alter table public.lead_discovery_questions enable row level security;

drop policy if exists lead_discovery_questions_select on public.lead_discovery_questions;
create policy lead_discovery_questions_select on public.lead_discovery_questions
  for select using (public.is_team_member());

drop policy if exists lead_discovery_questions_insert on public.lead_discovery_questions;
create policy lead_discovery_questions_insert on public.lead_discovery_questions
  for insert with check (
    public.current_member_role() in ('owner', 'admin', 'member')
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists lead_discovery_questions_update on public.lead_discovery_questions;
create policy lead_discovery_questions_update on public.lead_discovery_questions
  for update using (public.current_member_role() in ('owner', 'admin', 'member'))
  with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop trigger if exists trg_touch_lead_discovery_questions on public.lead_discovery_questions;
create trigger trg_touch_lead_discovery_questions
  before update on public.lead_discovery_questions
  for each row execute function public.fn_touch_updated_at();

comment on table public.lead_discovery_questions is
  'Open-ended lead discovery questions with editable answers and references to interaction evidence.';

notify pgrst, 'reload schema';