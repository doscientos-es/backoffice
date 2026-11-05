-- Proposal detail selects demo_url under the authenticated user's RLS policies.
-- Column-level grants predate this field, so grant only the new non-price field.
grant select (demo_url) on public.proposals to authenticated;