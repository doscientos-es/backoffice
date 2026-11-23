-- A reusable personal signature is private to its owner. Proposal evidence
-- must store a separate copy rather than referring to this mutable record.
create table public.team_member_signatures (
  member_id uuid primary key references public.team_members(id) on delete cascade,
  signature jsonb not null check (
    jsonb_typeof(signature) = 'object' and octet_length(signature::text) <= 250000
  ),
  updated_at timestamptz not null default now()
);

alter table public.team_member_signatures enable row level security;
revoke all on public.team_member_signatures from public, anon, authenticated;
grant select, insert, update, delete on public.team_member_signatures to authenticated;
create policy team_member_signatures_self on public.team_member_signatures
  for all to authenticated
  using (member_id = auth.uid() and public.is_team_member())
  with check (member_id = auth.uid() and public.is_team_member());

notify pgrst, 'reload schema';