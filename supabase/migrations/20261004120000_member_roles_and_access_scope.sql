-- ============================================================
-- Team roles by job function + access scope per member.
-- Roles are permission bundles (see role_permissions); the scope
-- decides whether a member sees every record ('all') or only the
-- ones assigned to them ('assigned'). Owners/admins always see all.
-- Enum values are added in their own migration because Postgres
-- cannot use new enum labels in the transaction that adds them.
-- ============================================================

alter type public.member_role add value if not exists 'sales';
alter type public.member_role add value if not exists 'delivery';
alter type public.member_role add value if not exists 'accountant';

alter table public.team_members
  add column if not exists access_scope text not null default 'assigned';

-- Least privilege is the safe default for new collaborators. Owners/admins are
-- treated as full-scope by member_has_full_scope(), regardless of this value.
update public.team_members
set access_scope = 'assigned'
where role not in ('owner', 'admin') and access_scope = 'all';

alter table public.team_members
  alter column access_scope set default 'assigned';

alter table public.team_members
  drop constraint if exists team_members_access_scope_check;
alter table public.team_members
  add constraint team_members_access_scope_check
  check (access_scope in ('all', 'assigned'));

comment on column public.team_members.access_scope is
  'all = sees every record of the modules their role allows; assigned = only leads, proposals, projects, tasks and clients linked to them.';
