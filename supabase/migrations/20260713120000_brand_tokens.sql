-- ============================================================
-- Brand Tokens: design tokens (colors, typography, spacing…)
-- Permite exportar la identidad visual en 1 clic (Tailwind, CSS, JSON, IA).
-- ============================================================

create table if not exists public.brand_tokens (
  id           uuid primary key default gen_random_uuid(),
  token_group  text not null check (token_group in ('color', 'typography', 'spacing', 'radius', 'shadow')),
  key          text not null,
  value        text not null,
  value_dark   text,
  description  text,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (token_group, key)
);

alter table public.brand_tokens enable row level security;

create policy "brand_tokens_select" on public.brand_tokens
  for select to authenticated using (public.is_team_member());

create policy "brand_tokens_insert" on public.brand_tokens
  for insert to authenticated
  with check (public.current_member_role() in ('owner', 'admin'));

create policy "brand_tokens_update" on public.brand_tokens
  for update to authenticated
  using (public.current_member_role() in ('owner', 'admin'));

create policy "brand_tokens_delete" on public.brand_tokens
  for delete to authenticated
  using (public.current_member_role() in ('owner', 'admin'));

-- ---- Seed desde globals.css ----
insert into public.brand_tokens (token_group, key, value, value_dark, description, sort_order) values
  -- Colors
  ('color', 'primary',            '#2a4227', 'oklch(0.922 0 0)',          'Color primario de marca',    10),
  ('color', 'primary-foreground', '#ffffff', 'oklch(0.205 0 0)',          'Texto sobre primario',       11),
  ('color', 'accent',             '#2a4227', 'oklch(0.269 0 0)',          'Color de acento',            20),
  ('color', 'accent-foreground',  '#ffffff', 'oklch(0.985 0 0)',          'Texto sobre acento',         21),
  ('color', 'background',         '#fafafa', 'oklch(0.145 0 0)',          'Fondo principal',            30),
  ('color', 'foreground',         '#171717', 'oklch(0.985 0 0)',          'Texto principal',            31),
  ('color', 'card',               '#ffffff', 'oklch(0.205 0 0)',          'Fondo de tarjeta',           32),
  ('color', 'secondary',          '#f3f4f6', 'oklch(0.269 0 0)',          'Fondo secundario',           40),
  ('color', 'secondary-foreground','#171717','oklch(0.985 0 0)',          'Texto sobre secundario',     41),
  ('color', 'muted',              '#f5f5f5', 'oklch(0.269 0 0)',          'Fondo atenuado',             50),
  ('color', 'muted-foreground',   '#737373', 'oklch(0.708 0 0)',          'Texto atenuado',             51),
  ('color', 'border',             '#d4d4d4', 'oklch(1 0 0 / 15%)',        'Color de borde',             60),
  ('color', 'destructive',        '#ef4444', 'oklch(0.704 0.191 22.216)', 'Error / destructivo',        70),
  ('color', 'success',            '#16a34a', '#22c55e',                   'Éxito',                      80),
  ('color', 'warning',            '#ca8a04', '#eab308',                   'Advertencia',                90),
  ('color', 'info',               '#2563eb', '#3b82f6',                   'Informativo',               100),
  -- Radius
  ('radius', 'base', '0.625rem', null, 'Radio de borde base (--radius)', 10),
  -- Typography
  ('typography', 'font-sans', 'Inter, ui-sans-serif, system-ui, sans-serif', null, 'Fuente principal', 10)
on conflict (token_group, key) do nothing;
