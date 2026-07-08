-- Feature: Social Hub
-- Centralised publishing + analytics for Instagram, Facebook and LinkedIn.
-- A single composed post (social_posts) fans out to one target per network
-- (social_post_targets), each tracking its own publish status, insights
-- (social_post_insights) and comments (social_comments) independently.

-- ─── social_posts ──────────────────────────────────────────────────────────
-- One row per composition. `media` holds an ordered array of
-- { storage_path, public_url, type, mime } objects uploaded to the
-- `social-media` bucket (Instagram requires public URLs at publish time).
create table if not exists public.social_posts (
  id            uuid        primary key default gen_random_uuid(),
  caption       text        not null default '',
  media_kind    text        not null default 'text'
                  check (media_kind in ('text', 'photo', 'video', 'carousel')),
  media         jsonb       not null default '[]'::jsonb,
  status        text        not null default 'draft'
                  check (status in ('draft', 'scheduled', 'publishing',
                                    'published', 'partially_failed', 'failed')),
  scheduled_at  timestamptz,
  published_at  timestamptz,
  created_by    uuid        references public.team_members(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── social_post_targets ───────────────────────────────────────────────────
-- One row per (post, network). Independent status so a post can succeed on
-- Instagram and fail on LinkedIn without blocking the other.
create table if not exists public.social_post_targets (
  id            uuid        primary key default gen_random_uuid(),
  post_id       uuid        not null references public.social_posts(id) on delete cascade,
  platform      text        not null
                  check (platform in ('instagram', 'facebook', 'linkedin')),
  status        text        not null default 'pending'
                  check (status in ('pending', 'publishing', 'published', 'failed')),
  remote_id     text,
  remote_url    text,
  error         text,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (post_id, platform)
);

-- ─── social_post_insights ──────────────────────────────────────────────────
-- Latest metrics snapshot per target (upserted on sync). `raw` keeps the
-- untouched platform payload for future metric extraction without a migration.
create table if not exists public.social_post_insights (
  id               uuid        primary key default gen_random_uuid(),
  target_id        uuid        not null references public.social_post_targets(id) on delete cascade,
  impressions      integer     not null default 0,
  reach            integer     not null default 0,
  likes            integer     not null default 0,
  comments         integer     not null default 0,
  shares           integer     not null default 0,
  saves            integer     not null default 0,
  video_views      integer     not null default 0,
  engagement_rate  numeric(6,4) not null default 0,
  raw              jsonb       not null default '{}'::jsonb,
  fetched_at       timestamptz not null default now(),
  unique (target_id)
);

-- ─── social_comments ───────────────────────────────────────────────────────
-- Unified inbox of comments across networks. Deduped by (target, remote id).
create table if not exists public.social_comments (
  id                uuid        primary key default gen_random_uuid(),
  target_id         uuid        not null references public.social_post_targets(id) on delete cascade,
  platform          text        not null
                      check (platform in ('instagram', 'facebook', 'linkedin')),
  remote_comment_id text        not null,
  author_name       text        not null default '',
  author_id         text,
  text              text        not null default '',
  like_count        integer     not null default 0,
  replied           boolean     not null default false,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (target_id, remote_comment_id)
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index if not exists social_posts_status_idx
  on public.social_posts(status) where deleted_at is null;
create index if not exists social_posts_scheduled_idx
  on public.social_posts(scheduled_at) where status = 'scheduled' and deleted_at is null;
create index if not exists social_post_targets_post_idx
  on public.social_post_targets(post_id);
create index if not exists social_comments_target_idx
  on public.social_comments(target_id);
create index if not exists social_comments_unreplied_idx
  on public.social_comments(published_at desc) where replied = false;

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Read: any team member. Write: member+ (comments/insights are written by the
-- service_role sync jobs, which bypass RLS — these policies are defence in
-- depth mirroring the rest of the schema).
do $$
declare t text;
begin
  foreach t in array array[
    'social_posts', 'social_post_targets', 'social_post_insights', 'social_comments'
  ] loop
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

-- ─── updated_at triggers ─────────────────────────────────────────────────────
drop trigger if exists trg_touch_social_posts on public.social_posts;
create trigger trg_touch_social_posts
  before update on public.social_posts
  for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_social_post_targets on public.social_post_targets;
create trigger trg_touch_social_post_targets
  before update on public.social_post_targets
  for each row execute function public.fn_touch_updated_at();

-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- PUBLIC bucket: Instagram/Facebook Graph publishing requires a publicly
-- reachable media URL at container-creation time. 100 MB cap covers reels/video.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media', 'social-media', true,
  104857600, -- 100 MB
  array[
    'image/png', 'image/jpeg', 'image/webp',
    'video/mp4', 'video/quicktime'
  ]
)
on conflict (id) do nothing;

-- ---- Storage policies ----
-- Objects are world-readable (public bucket). Writes/deletes stay restricted to
-- the team; the happy-path upload runs via the service_role admin client.
drop policy if exists "social_media_select" on storage.objects;
create policy "social_media_select" on storage.objects
  for select using (bucket_id = 'social-media');

drop policy if exists "social_media_insert" on storage.objects;
create policy "social_media_insert" on storage.objects
  for insert with check (
    bucket_id = 'social-media'
    and public.current_member_role() in ('owner', 'admin', 'member')
  );

drop policy if exists "social_media_delete" on storage.objects;
create policy "social_media_delete" on storage.objects
  for delete using (
    bucket_id = 'social-media'
    and public.current_member_role() in ('owner', 'admin')
  );
