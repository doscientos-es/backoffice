/**
 * High-level helpers built on top of `lib/integrations/github` that:
 *   • Know about our `projects.github_sync_mode` contract.
 *   • Are safe to call fire-and-forget from server actions (errors logged, not thrown).
 *   • Persist the GitHub link + `github_synced_at` back to the row.
 *
 * Only `bidirectional` projects with `github_auto_sync = true` are eligible.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createGitHubIssue, createGitHubMilestone } from "./github";

export type GitHubSyncMode = "none" | "link_only" | "bidirectional";

/**
 * Parse a GitHub repo URL into `{ owner, name }`. Accepts:
 *   https://github.com/<owner>/<repo>
 *   https://github.com/<owner>/<repo>.git
 *   https://github.com/<owner>/<repo>/...
 */
export function parseGithubRepoUrl(url: string): { owner: string; name: string } | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/.?#]+)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match || !match[1] || !match[2]) return null;
  return { owner: match[1], name: match[2] };
}

interface ProjectSyncRow {
  id: string;
  github_sync_mode: GitHubSyncMode;
  github_auto_sync: boolean;
  github_repo_owner: string | null;
  github_repo_name: string | null;
  github_installation_id: number | null;
}

async function loadEligibleProject(projectId: string): Promise<ProjectSyncRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select(
      "id, github_sync_mode, github_auto_sync, github_repo_owner, github_repo_name, github_installation_id",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as ProjectSyncRow;
  if (row.github_sync_mode !== "bidirectional") return null;
  if (!row.github_auto_sync) return null;
  if (!row.github_repo_owner || !row.github_repo_name || !row.github_installation_id) return null;
  return row;
}

/**
 * Auto-create a GitHub issue for a task. Non-blocking: failures are logged and swallowed.
 * Returns true on success, false otherwise.
 */
export async function autoSyncTaskIssue(taskId: string, projectId: string): Promise<boolean> {
  try {
    const project = await loadEligibleProject(projectId);
    if (!project) return false;
    const admin = createAdminClient();
    const { data: task } = await admin
      .from("tasks")
      .select("id, title, description, github_issue_number")
      .eq("id", taskId)
      .maybeSingle();
    if (!task || task.github_issue_number) return false;

    const issue = await createGitHubIssue({
      installationId: project.github_installation_id as number,
      owner: project.github_repo_owner as string,
      repo: project.github_repo_name as string,
      title: task.title as string,
      body: (task.description as string | null) ?? "",
    });

    const now = new Date().toISOString();
    await admin
      .from("tasks")
      .update({
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
        github_synced_at: now,
      })
      .eq("id", taskId);
    await admin.from("projects").update({ github_synced_at: now }).eq("id", project.id);
    return true;
  } catch (err) {
    console.error("[github-sync] autoSyncTaskIssue failed", { taskId, projectId, err });
    return false;
  }
}

/**
 * Auto-create a GitHub milestone. Non-blocking — failures are logged and swallowed.
 */
export async function autoSyncMilestone(milestoneId: string, projectId: string): Promise<boolean> {
  try {
    const project = await loadEligibleProject(projectId);
    if (!project) return false;
    const admin = createAdminClient();
    const { data: milestone } = await admin
      .from("milestones")
      .select("id, name, due_date, github_milestone_number")
      .eq("id", milestoneId)
      .maybeSingle();
    if (!milestone || milestone.github_milestone_number) return false;

    const due = milestone.due_date ? `${milestone.due_date as string}T00:00:00Z` : undefined;
    const result = await createGitHubMilestone({
      installationId: project.github_installation_id as number,
      owner: project.github_repo_owner as string,
      repo: project.github_repo_name as string,
      title: milestone.name as string,
      dueOn: due,
    });

    const now = new Date().toISOString();
    await admin
      .from("milestones")
      .update({ github_milestone_number: result.number })
      .eq("id", milestoneId);
    await admin.from("projects").update({ github_synced_at: now }).eq("id", project.id);
    return true;
  } catch (err) {
    console.error("[github-sync] autoSyncMilestone failed", { milestoneId, projectId, err });
    return false;
  }
}
