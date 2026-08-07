-- ============================================================
-- Brand guides: copy and application guidelines for the public brand portal.
-- Draft content remains private; only the public API may read published rows.
-- ============================================================

create table if not exists public.brand_guides (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title        text not null,
  description  text,
  content      text not null default '',
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order   integer not null default 0 check (sort_order >= 0),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.brand_guides enable row level security;

create policy "brand_guides_select_team" on public.brand_guides
  for select to authenticated using (public.is_team_member());

create policy "brand_guides_insert_admin" on public.brand_guides
  for insert to authenticated
  with check (public.current_member_role() in ('owner', 'admin'));

create policy "brand_guides_update_admin" on public.brand_guides
  for update to authenticated
  using (public.current_member_role() in ('owner', 'admin'))
  with check (public.current_member_role() in ('owner', 'admin'));

create policy "brand_guides_delete_admin" on public.brand_guides
  for delete to authenticated
  using (public.current_member_role() in ('owner', 'admin'));

create index if not exists brand_guides_public_order_idx
  on public.brand_guides (sort_order, published_at desc)
  where status = 'published';