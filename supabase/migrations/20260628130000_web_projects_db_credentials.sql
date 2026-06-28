-- Add database connection credentials to web_projects for automated backups.
-- host / port / name / user are stored as plaintext (non-secret connection
-- metadata). The password is stored AES-256-GCM encrypted at the application
-- layer (see lib/vault/crypto.ts) in db_pass_encrypted, never as plaintext.

alter table public.web_projects
  add column if not exists db_host text,
  add column if not exists db_port integer,
  add column if not exists db_name text,
  add column if not exists db_user text,
  add column if not exists db_pass_encrypted text;
