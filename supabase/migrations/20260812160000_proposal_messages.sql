-- Client/team conversation attached to a proposal portal.
create table if not exists public.proposal_messages (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  author_type text not null check (author_type in ('client', 'team')),
  author_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists proposal_messages_proposal_created_idx
  on public.proposal_messages(proposal_id, created_at);

alter table public.proposal_messages enable row level security;

drop policy if exists "proposal_messages_team_select" on public.proposal_messages;
create policy "proposal_messages_team_select" on public.proposal_messages
  for select using (public.current_member_role() is not null);
