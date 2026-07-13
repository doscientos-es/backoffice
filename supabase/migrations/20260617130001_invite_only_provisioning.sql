-- ============================================================
-- Invite-only provisioning (defense in depth)
-- ============================================================
-- Incident: self-service signups (supabase.auth.signUp from the public
-- anon key) created auth.users rows, and handle_new_user auto-granted a
-- team_members row with role 'member' to every new auth user — giving an
-- attacker app access without any invitation.
--
-- Primary fix is disabling open signup at the GoTrue level
-- (disable_signup = true). This trigger change is the durable code-level
-- guard so that, even if signup is ever re-enabled, only users created via
-- an admin invitation (auth.users.invited_at IS NOT NULL) are provisioned
-- as team_members. Self-signups get no membership row and therefore no
-- access (requireUser fails without a team_members row).
--
-- The invite flow (settings/team inviteMember) uses inviteUserByEmail, which
-- sets invited_at, so its behaviour is preserved exactly.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Only auto-provision membership for invited users. Self-service signups
  -- (invited_at IS NULL) must never gain a team_members row automatically.
  if new.invited_at is null then
    return new;
  end if;

  insert into public.team_members (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end $$;
