-- ============================================================
-- Marketing: newsletter issues and editorial planning
-- ============================================================
-- A newsletter issue is the editorial source. When it is sent, it can be
-- linked to the existing lead_campaigns / lead_campaign_sends tracking tables.

create table if not exists public.newsletter_issues (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  slug            text        not null unique,
  subject         text        not null,
  preview_text    text,
  body_markdown   text        not null,
  cta_label       text,
  cta_url         text,
  audience_key    text        not null default 'all_leads'
                  check (audience_key in ('all_leads','active_leads','calculator_leads','lost_leads','clients')),
  status          text        not null default 'draft'
                  check (status in ('draft','scheduled','sent','published','archived')),
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  published_at    timestamptz,
  public_slug     text,
  lead_campaign_id uuid       references public.lead_campaigns(id) on delete set null,
  created_by      uuid        references public.team_members(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists newsletter_issues_status_idx
  on public.newsletter_issues (status, scheduled_at)
  where deleted_at is null;

create index if not exists newsletter_issues_campaign_idx
  on public.newsletter_issues (lead_campaign_id)
  where lead_campaign_id is not null;

alter table public.newsletter_issues enable row level security;

drop policy if exists newsletter_issues_select on public.newsletter_issues;
create policy newsletter_issues_select on public.newsletter_issues
  for select using (public.is_team_member());

drop policy if exists newsletter_issues_insert on public.newsletter_issues;
create policy newsletter_issues_insert on public.newsletter_issues
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists newsletter_issues_update on public.newsletter_issues;
create policy newsletter_issues_update on public.newsletter_issues
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists newsletter_issues_delete on public.newsletter_issues;
create policy newsletter_issues_delete on public.newsletter_issues
  for delete using (public.current_member_role() in ('owner','admin'));

drop trigger if exists trg_touch_newsletter_issues on public.newsletter_issues;
create trigger trg_touch_newsletter_issues
  before update on public.newsletter_issues
  for each row execute function public.fn_touch_updated_at();
