-- ============================================================
-- Marketing: outbound email campaigns to leads
-- ============================================================
-- Permite lanzar campañas de email a grupos de leads (especialmente
-- archivados) y hacer tracking de apertura (pixel) y clicks.
--
-- Tables:
--   lead_campaigns       — definición de una campaña
--   lead_campaign_sends  — un envío por lead, con token de tracking

-- ---------- lead_campaigns ----------
create table if not exists public.lead_campaigns (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  subject     text        not null,
  body_html   text        not null,
  -- 'draft' → 'sending' → 'sent' | 'paused'
  status      text        not null default 'draft'
              check (status in ('draft','sending','sent','paused')),
  created_by  uuid        references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists lead_campaigns_status_idx
  on public.lead_campaigns (status)
  where deleted_at is null;

-- ---------- lead_campaign_sends ----------
create table if not exists public.lead_campaign_sends (
  id               uuid        primary key default gen_random_uuid(),
  campaign_id      uuid        not null references public.lead_campaigns(id) on delete cascade,
  lead_id          uuid        references public.leads(id) on delete set null,
  -- snapshot of the email at send time (lead email may change later)
  email            text        not null,
  -- unique token embedded in the pixel URL and link wrappers
  tracking_token   uuid        not null default gen_random_uuid() unique,
  resend_email_id  text,
  sent_at          timestamptz,
  -- open tracking
  opened_at        timestamptz,
  open_count       int         not null default 0,
  -- click tracking
  clicked_at       timestamptz,
  click_count      int         not null default 0,
  -- delivery issues
  bounced_at       timestamptz,
  unsubscribed_at  timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists lead_campaign_sends_campaign_idx
  on public.lead_campaign_sends (campaign_id);

create index if not exists lead_campaign_sends_lead_idx
  on public.lead_campaign_sends (lead_id)
  where lead_id is not null;

create index if not exists lead_campaign_sends_token_idx
  on public.lead_campaign_sends (tracking_token);

-- ---------- RLS ----------
alter table public.lead_campaigns      enable row level security;
alter table public.lead_campaign_sends enable row level security;

-- campaigns: all team members read; member+ write; admin+ delete
drop policy if exists lead_campaigns_select on public.lead_campaigns;
create policy lead_campaigns_select on public.lead_campaigns
  for select using (public.is_team_member());

drop policy if exists lead_campaigns_insert on public.lead_campaigns;
create policy lead_campaigns_insert on public.lead_campaigns
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists lead_campaigns_update on public.lead_campaigns;
create policy lead_campaigns_update on public.lead_campaigns
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists lead_campaigns_delete on public.lead_campaigns;
create policy lead_campaigns_delete on public.lead_campaigns
  for delete using (public.current_member_role() in ('owner','admin'));

-- sends: same rules
drop policy if exists lead_campaign_sends_select on public.lead_campaign_sends;
create policy lead_campaign_sends_select on public.lead_campaign_sends
  for select using (public.is_team_member());

drop policy if exists lead_campaign_sends_insert on public.lead_campaign_sends;
create policy lead_campaign_sends_insert on public.lead_campaign_sends
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists lead_campaign_sends_update on public.lead_campaign_sends;
create policy lead_campaign_sends_update on public.lead_campaign_sends
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists lead_campaign_sends_delete on public.lead_campaign_sends;
create policy lead_campaign_sends_delete on public.lead_campaign_sends
  for delete using (public.current_member_role() in ('owner','admin'));

-- ---------- updated_at trigger for lead_campaigns ----------
drop trigger if exists trg_touch_lead_campaigns on public.lead_campaigns;
create trigger trg_touch_lead_campaigns
  before update on public.lead_campaigns
  for each row execute function public.fn_touch_updated_at();
