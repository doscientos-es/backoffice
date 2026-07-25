-- Google Business Profile: reviews, location performance and post CTA actions.

alter table public.social_post_insights
  add column if not exists actions integer not null default 0;

create table if not exists public.google_business_reviews (
  id                   uuid primary key default gen_random_uuid(),
  account_id           text not null,
  location_id          text not null,
  review_name          text not null unique,
  reviewer_name        text not null default '',
  reviewer_photo_url   text,
  is_anonymous         boolean not null default false,
  star_rating          text not null default 'STAR_RATING_UNSPECIFIED',
  comment              text not null default '',
  create_time          timestamptz,
  update_time           timestamptz,
  reply_comment        text,
  reply_update_time    timestamptz,
  reply_state          text,
  policy_violation     text,
  synced_at            timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.google_business_profile_metrics (
  id             uuid primary key default gen_random_uuid(),
  location_id    text not null,
  metric         text not null,
  metric_date    date not null,
  value          bigint not null default 0,
  fetched_at     timestamptz not null default now(),
  unique (location_id, metric, metric_date)
);

create index if not exists google_business_reviews_location_idx
  on public.google_business_reviews(location_id, create_time desc);
create index if not exists google_business_reviews_pending_idx
  on public.google_business_reviews(location_id, create_time desc)
  where reply_comment is null;
create index if not exists google_business_metrics_date_idx
  on public.google_business_profile_metrics(location_id, metric_date desc);

do $$
declare t text;
begin
  foreach t in array array['google_business_reviews', 'google_business_profile_metrics'] loop
    execute format('alter table public.%s enable row level security', t);

    execute format('drop policy if exists "%s_select" on public.%s', t, t);
    execute format('create policy "%s_select" on public.%s for select using (public.is_team_member())', t, t);

    execute format('drop policy if exists "%s_insert" on public.%s', t, t);
    execute format('create policy "%s_insert" on public.%s for insert with check (public.current_member_role() in (''owner'',''admin'',''member''))', t, t);

    execute format('drop policy if exists "%s_update" on public.%s', t, t);
    execute format('create policy "%s_update" on public.%s for update using (public.current_member_role() in (''owner'',''admin'',''member''))', t, t);

    execute format('drop policy if exists "%s_delete" on public.%s', t, t);
    execute format('create policy "%s_delete" on public.%s for delete using (public.current_member_role() in (''owner'',''admin''))', t, t);
  end loop;
end $$;

drop trigger if exists trg_touch_google_business_reviews on public.google_business_reviews;
create trigger trg_touch_google_business_reviews
  before update on public.google_business_reviews
  for each row execute function public.fn_touch_updated_at();