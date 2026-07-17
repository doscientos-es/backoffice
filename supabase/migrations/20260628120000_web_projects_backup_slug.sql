-- Add backup_slug to web_projects
-- This optional field maps a web project to a folder in the FileBrowser server
-- (e.g. "optinergia" maps to the FileBrowser folder for that client).
-- Leave null when backups are not configured for a site.

alter table public.web_projects
  add column if not exists backup_slug text;
