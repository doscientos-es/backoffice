-- Track the GitHub branch auto-created alongside an issue.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS github_branch text;
