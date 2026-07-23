-- Feature: Social Hub — Google Business Profile targets.
-- This is additive: existing Instagram, Facebook and LinkedIn rows remain valid.

alter table public.social_post_targets
  drop constraint if exists social_post_targets_platform_check;

alter table public.social_post_targets
  add constraint social_post_targets_platform_check
  check (platform in ('instagram', 'facebook', 'linkedin', 'google_business_profile'));

alter table public.social_comments
  drop constraint if exists social_comments_platform_check;

alter table public.social_comments
  add constraint social_comments_platform_check
  check (platform in ('instagram', 'facebook', 'linkedin', 'google_business_profile'));