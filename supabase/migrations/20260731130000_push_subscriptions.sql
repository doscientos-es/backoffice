create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_member on public.push_subscriptions(member_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own_select" on public.push_subscriptions;
drop policy if exists "push_subscriptions_own_insert" on public.push_subscriptions;
drop policy if exists "push_subscriptions_own_delete" on public.push_subscriptions;
create policy "push_subscriptions_own_select" on public.push_subscriptions for select using (member_id = auth.uid());
create policy "push_subscriptions_own_insert" on public.push_subscriptions for insert with check (member_id = auth.uid());
create policy "push_subscriptions_own_delete" on public.push_subscriptions for delete using (member_id = auth.uid());
