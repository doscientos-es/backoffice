-- ============================================================
-- Onboarding checklists por tipo de proyecto.
-- ------------------------------------------------------------
-- Plantillas reutilizables (kickoff, accesos, deploy, entrega)
-- que se copian a un proyecto en su alta. Cada proyecto guarda
-- sus propios items (project_checklist_items) para poder marcar
-- el progreso sin tocar la plantilla original. Uso interno: no
-- se muestran nunca en el portal del cliente.
-- ============================================================

-- ---------- Plantillas ----------
create table if not exists public.onboarding_templates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text not null,
  description text,
  position    int not null default 0,
  deleted_at  timestamptz
);

create table if not exists public.onboarding_template_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  label       text not null,
  position    int not null default 0
);

create index if not exists onboarding_template_items_tpl_idx
  on public.onboarding_template_items(template_id);

-- ---------- Items por proyecto ----------
create table if not exists public.project_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  label       text not null,
  is_done     boolean not null default false,
  done_at     timestamptz,
  position    int not null default 0,
  deleted_at  timestamptz
);

create index if not exists project_checklist_items_project_idx
  on public.project_checklist_items(project_id) where deleted_at is null;

-- updated_at autotouch (trigger compartido)
drop trigger if exists trg_touch_onboarding_templates on public.onboarding_templates;
create trigger trg_touch_onboarding_templates before update on public.onboarding_templates
  for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_project_checklist_items on public.project_checklist_items;
create trigger trg_touch_project_checklist_items before update on public.project_checklist_items
  for each row execute function public.fn_touch_updated_at();

-- ---------- RLS ----------
-- Lectura para cualquier team_member. Las plantillas son
-- configuración (mutación owner/admin); los items de proyecto
-- los gestiona cualquier rol >= member, igual que work_logs.
alter table public.onboarding_templates       enable row level security;
alter table public.onboarding_template_items  enable row level security;
alter table public.project_checklist_items    enable row level security;

drop policy if exists "onboarding_templates_select" on public.onboarding_templates;
create policy "onboarding_templates_select" on public.onboarding_templates
  for select using (public.is_team_member() and deleted_at is null);

drop policy if exists "onboarding_templates_write" on public.onboarding_templates;
create policy "onboarding_templates_write" on public.onboarding_templates
  for all using (public.current_member_role() in ('owner','admin'))
  with check (public.current_member_role() in ('owner','admin'));

drop policy if exists "onboarding_template_items_select" on public.onboarding_template_items;
create policy "onboarding_template_items_select" on public.onboarding_template_items
  for select using (public.is_team_member());

drop policy if exists "onboarding_template_items_write" on public.onboarding_template_items;
create policy "onboarding_template_items_write" on public.onboarding_template_items
  for all using (public.current_member_role() in ('owner','admin'))
  with check (public.current_member_role() in ('owner','admin'));

drop policy if exists "project_checklist_items_select" on public.project_checklist_items;
create policy "project_checklist_items_select" on public.project_checklist_items
  for select using (public.is_team_member() and deleted_at is null);

drop policy if exists "project_checklist_items_insert" on public.project_checklist_items;
create policy "project_checklist_items_insert" on public.project_checklist_items
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists "project_checklist_items_update" on public.project_checklist_items;
create policy "project_checklist_items_update" on public.project_checklist_items
  for update using (public.current_member_role() in ('owner','admin','member'));

-- ---------- Seed (idempotente) ----------
insert into public.onboarding_templates (name, description, position)
select * from (values
  ('Web corporativa', 'Alta y entrega de una web a medida.', 1),
  ('Tienda online (e-commerce)', 'Proyecto con catálogo, pagos y envíos.', 2),
  ('Landing / campaña', 'Página de campaña con foco en conversión.', 3)
) as t(name, description, position)
where not exists (select 1 from public.onboarding_templates);

insert into public.onboarding_template_items (template_id, label, position)
select tpl.id, x.label, x.position
from public.onboarding_templates tpl
join (values
  ('Web corporativa', 'Recibir accesos: dominio, hosting y DNS', 1),
  ('Web corporativa', 'Crear repositorio y entorno de staging', 2),
  ('Web corporativa', 'Definir mapa de páginas y contenidos', 3),
  ('Web corporativa', 'Configurar analítica y consentimiento de cookies', 4),
  ('Web corporativa', 'Deploy a producción y comprobación de SSL', 5),
  ('Web corporativa', 'Entrega: manual y traspaso de accesos', 6),
  ('Tienda online (e-commerce)', 'Recibir accesos y pasarela de pago', 1),
  ('Tienda online (e-commerce)', 'Importar catálogo de productos', 2),
  ('Tienda online (e-commerce)', 'Configurar impuestos, envíos y devoluciones', 3),
  ('Tienda online (e-commerce)', 'Pruebas de compra de extremo a extremo', 4),
  ('Tienda online (e-commerce)', 'Deploy a producción y comprobación de SSL', 5),
  ('Tienda online (e-commerce)', 'Entrega: formación y traspaso de accesos', 6),
  ('Landing / campaña', 'Recibir copys, imágenes y dominio', 1),
  ('Landing / campaña', 'Maquetar landing y formulario', 2),
  ('Landing / campaña', 'Conectar leads con CRM/Meta', 3),
  ('Landing / campaña', 'Configurar analítica y eventos de conversión', 4),
  ('Landing / campaña', 'Deploy y QA en móvil y escritorio', 5)
) as x(tpl_name, label, position) on x.tpl_name = tpl.name
where not exists (select 1 from public.onboarding_template_items);
