-- Add backup_slug to web_projects
-- This optional field maps a web project to a folder in the FileBrowser server
-- (e.g. "optinergia" → http://100.72.49.68:8083/api/resources/optinergia).
-- Leave null when backups are not configured for a site.

alter table public.web_projects
  add column if not exists backup_slug text;
