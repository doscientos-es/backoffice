-- Add optional display label to clients.
-- When set, the UI uses this instead of the legal name (useful when the
-- razón social is long or cryptic). Falls back to `name` when null.

alter table public.clients
  add column if not exists label text;
