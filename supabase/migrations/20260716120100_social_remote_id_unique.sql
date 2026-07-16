-- Feature: Social Hub — remote identity deduplication
-- A platform remote id identifies one published object. This prevents concurrent
-- historical imports from creating duplicate local posts.
create unique index if not exists social_post_targets_platform_remote_idx
  on public.social_post_targets(platform, remote_id)
  where remote_id is not null;
