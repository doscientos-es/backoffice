-- Delivery acceptance / acta de entrega.
-- This deliberately models expiry as "conformidad no impugnada en plazo",
-- never as a forged or automatic signature.

alter table public.proposals
  add column if not exists delivery_acceptance_enabled boolean not null default false,
  add column if not exists delivery_acceptance_days smallint not null default 7,
  add column if not exists delivery_acceptance_mode text not null default 'explicit_or_uncontested';

alter table public.proposals
  drop constraint if exists proposals_delivery_acceptance_days_chk,
  add constraint proposals_delivery_acceptance_days_chk
    check (delivery_acceptance_days between 1 and 30),
  drop constraint if exists proposals_delivery_acceptance_mode_chk,
  add constraint proposals_delivery_acceptance_mode_chk
    check (delivery_acceptance_mode in ('explicit_only', 'explicit_or_uncontested'));

create table if not exists public.delivery_acceptances (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  version integer not null default 1,
  portal_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'draft',
  document_snapshot jsonb not null default '{}'::jsonb,
  document_hash text,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  review_deadline_at timestamptz,
  accepted_at timestamptz,
  accepted_by_name text,
  accepted_by_role text,
  accepted_by_email text,
  accepted_ip inet,
  accepted_user_agent text,
  uncontested_at timestamptz,
  disputed_at timestamptz,
  dispute_reason text,
  dispute_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, version),
  constraint delivery_acceptances_status_chk check (
    status in ('draft', 'sent', 'viewed', 'accepted', 'accepted_by_deadline', 'disputed', 'superseded', 'cancelled')
  )
);

create index if not exists delivery_acceptances_proposal_idx
  on public.delivery_acceptances(proposal_id, version desc);
create index if not exists delivery_acceptances_deadline_idx
  on public.delivery_acceptances(review_deadline_at)
  where status in ('sent', 'viewed');

create table if not exists public.delivery_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  delivery_acceptance_id uuid not null references public.delivery_acceptances(id) on delete cascade,
  event_type text not null,
  actor_type text not null default 'client',
  actor_name text,
  actor_email text,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_acceptance_events_idx
  on public.delivery_acceptance_events(delivery_acceptance_id, created_at desc);

alter table public.delivery_acceptances enable row level security;
alter table public.delivery_acceptance_events enable row level security;

create policy delivery_acceptances_team_select on public.delivery_acceptances
  for select using (public.is_team_member());
create policy delivery_acceptances_team_insert on public.delivery_acceptances
  for insert with check (public.current_member_role() in ('owner','admin','member'));
create policy delivery_acceptances_team_update on public.delivery_acceptances
  for update using (public.current_member_role() in ('owner','admin','member'))
  with check (public.current_member_role() in ('owner','admin','member'));
create policy delivery_acceptance_events_team_select on public.delivery_acceptance_events
  for select using (public.is_team_member());
create policy delivery_acceptance_events_team_insert on public.delivery_acceptance_events
  for insert with check (public.current_member_role() in ('owner','admin','member'));

create trigger trg_touch_delivery_acceptances
  before update on public.delivery_acceptances
  for each row execute function public.fn_touch_updated_at();

comment on column public.proposals.delivery_acceptance_mode is
  'explicit_only or explicit_or_uncontested for B2B workflows; never creates a client signature.';
