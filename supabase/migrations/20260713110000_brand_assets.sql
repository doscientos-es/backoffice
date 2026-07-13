-- ============================================================
-- Brand Assets: logos, isotipos, backgrounds…
-- PUBLIC bucket → URLs permanentes reutilizables externamente.
-- ============================================================

create table if not exists public.brand_assets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      text not null default 'other'
                check (category in ('logo', 'isotipo', 'background', 'banner', 'other')),
  mime_type     text,
  size_bytes    bigint,
  storage_path  text not null,
  public_url    text not null,
  tags          text[] not null default '{}',
  uploaded_by   uuid references public.team_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ---- RLS ----
alter table public.brand_assets enable row level security;

create policy "brand_assets_select" on public.brand_assets
  for select using (public.is_team_member() and deleted_at is null);

create policy "brand_assets_insert" on public.brand_assets
  for insert to authenticated with check (public.is_team_member());

-- Solo admins/owners pueden soft-delete (update deleted_at)
create policy "brand_assets_update" on public.brand_assets
  for update using (
    public.current_member_role() in ('owner', 'admin')
  );

-- ---- Storage bucket (PUBLIC) ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets', 'brand-assets', true,
  20971520, -- 20 MB
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'
  ]
)
on conflict (id) do nothing;

-- Lectura pública sin autenticación (bucket público)
create policy "brand_assets_storage_select" on storage.objects
  for select using (bucket_id = 'brand-assets');

-- Subida: miembros del equipo autenticados
create policy "brand_assets_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-assets' and public.is_team_member());

-- Borrado: solo admins/owners
create policy "brand_assets_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets' and
    public.current_member_role() in ('owner', 'admin')
  );
