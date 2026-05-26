-- ============================================================
-- Step 8 — GitHub bidirectional integration (sec. 19-20 description.md)
-- ============================================================

-- 1. GitHub handle per team member (for user mapping in webhooks)
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS github_handle text UNIQUE;

-- 2. GitHub repository binding per project
--    (github_repo is the legacy free-text URL field kept for BC;
--     the three new columns give us structured owner + name + installation_id
--     which are required for the GitHub App REST API calls)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS github_repo_owner      text,
  ADD COLUMN IF NOT EXISTS github_repo_name       text,
  ADD COLUMN IF NOT EXISTS github_installation_id int;  -- GitHub App installation ID for the org

-- Backfill owner + name from the existing github_repo URL field where possible.
-- URL pattern: https://github.com/{owner}/{repo}
UPDATE projects
SET
  github_repo_owner = split_part(
    replace(github_repo, 'https://github.com/', ''), '/', 1
  ),
  github_repo_name = split_part(
    replace(github_repo, 'https://github.com/', ''), '/', 2
  )
WHERE github_repo IS NOT NULL
  AND github_repo LIKE 'https://github.com/%';

-- 3. Milestone: add github_milestone_number if missing (was defined in 5.21 but may not exist)
ALTER TABLE project_milestones
  ADD COLUMN IF NOT EXISTS github_milestone_number int;

-- 4. Index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_tasks_github_issue
  ON tasks(github_issue_number)
  WHERE github_issue_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_github_repo
  ON projects(github_repo_owner, github_repo_name)
  WHERE github_repo_owner IS NOT NULL AND github_repo_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_github_handle
  ON team_members(github_handle)
  WHERE github_handle IS NOT NULL;
