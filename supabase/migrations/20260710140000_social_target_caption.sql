-- Feature: Social Hub — per-network copy
-- A composition keeps a single shared caption (social_posts.caption) used by
-- default on every network. This adds an OPTIONAL per-target override so a post
-- can carry a tailored copy per platform. NULL means "inherit the post caption",
-- preserving the existing single-copy behaviour for every current row.
alter table public.social_post_targets
  add column if not exists caption text;
