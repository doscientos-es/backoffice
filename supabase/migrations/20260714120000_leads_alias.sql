-- Add optional display alias to leads, mirroring clients.label.
-- When set, the UI uses this short alias instead of the full name (useful
-- when the lead's name is long or ambiguous). Falls back to `name` when null.

alter table public.leads
  add column if not exists alias text;
