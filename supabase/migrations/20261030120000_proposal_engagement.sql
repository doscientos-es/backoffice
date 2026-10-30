-- ============================================================
-- Interés del lead en la propuesta pública ("lead caliente")
-- ============================================================
-- Cada acción con intención de compra en el portal (volver a abrirlo, ver el
-- precio, preguntar por WhatsApp, abrir la firma…) se guarda como un evento con
-- sus puntos. La suma de los últimos 14 días se refleja en leads.engagement_score
-- y permite subir la temperatura del lead. Los inserts los hace siempre el
-- servidor (service_role); el equipo solo puede leer.
-- ============================================================

create table if not exists public.proposal_engagement_events (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  event_type  text not null check (event_type in (
    'return_visit',
    'pricing_viewed',
    'terms_viewed',
    'pdf_download',
    'deck_completed',
    'whatsapp_click',
    'question_sent',
    'maintenance_selected',
    'sign_form_opened'
  )),
  -- Puntos que aportó este evento cuando ocurrió (no se recalculan a posteriori).
  points      integer not null default 0 check (points >= 0),
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists proposal_engagement_events_lead_idx
  on public.proposal_engagement_events (lead_id, created_at desc);

create index if not exists proposal_engagement_events_proposal_type_idx
  on public.proposal_engagement_events (proposal_id, event_type, created_at desc);

alter table public.proposal_engagement_events enable row level security;

drop policy if exists "proposal_engagement_events_select" on public.proposal_engagement_events;
create policy "proposal_engagement_events_select" on public.proposal_engagement_events
  for select using (public.is_team_member());

-- Resumen en el propio lead para poder ordenar y filtrar sin agregar cada vez.
alter table public.leads
  add column if not exists engagement_score integer not null default 0
    check (engagement_score between 0 and 100),
  add column if not exists last_engaged_at timestamptz;

comment on column public.leads.engagement_score is
  'Interés mostrado en la propuesta pública (0-100): suma de puntos de proposal_engagement_events de los últimos 14 días.';
comment on column public.leads.last_engaged_at is
  'Último evento de interés del lead en una propuesta pública.';

create index if not exists leads_engagement_idx
  on public.leads (engagement_score desc)
  where deleted_at is null and engagement_score > 0;
