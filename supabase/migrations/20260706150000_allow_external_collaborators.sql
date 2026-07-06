-- Allow inviting external collaborators (any Google account), not just
-- @doscientos.es addresses.
--
-- The `auth.users` BEFORE INSERT trigger `on_auth_user_created` had been
-- pointed manually at `check_internal_email()`, which raised
-- "Acceso restringido a miembros de Doscientos." for any email that did not
-- end in @doscientos.es. That manual change also clobbered the original
-- AFTER INSERT trigger that runs `handle_new_user()` (profile auto-creation).
--
-- This migration removes the domain restriction and restores the intended
-- profile-creation trigger so invitations to external emails succeed.

-- 1. Remove the domain-restriction trigger and its function.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.check_internal_email();

-- 2. Restore the profile-creation trigger (matches 20260525120300_rls.sql,
--    using the current invited-only variant of handle_new_user).
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
