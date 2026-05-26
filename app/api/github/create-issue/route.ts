/**
 * POST /api/github/create-issue
 *
 * Creates a GitHub issue from a CRM task and saves the link back to the task.
 * Body: { task_id: string }
 *
 * Steps (sec. 19.2):
 *   1. Load task + project (needs github_repo_owner / github_repo_name / installation_id)
 *   2. Create issue via GitHub API
 *   3. Save github_issue_number + github_issue_url to the task
 *   4. Log activity
 */

import { requireUser } from "@/lib/auth";
import { createGitHubIssue } from "@/lib/integrations/github";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  task_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  // Auth — must be a logged-in team member
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "task_id is required and must be a UUID" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const admin = createAdminClient();

  // Load task with project info
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, title, description, assignee_id, project_id, github_issue_number")
    .eq("id", body.task_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (taskErr || !task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  if (task.github_issue_number) {
    return NextResponse.json(
      { error: "task already linked to a GitHub issue", issue_number: task.github_issue_number },
      { status: 409 },
    );
  }

  if (!task.project_id) {
    return NextResponse.json({ error: "task has no linked project" }, { status: 422 });
  }

  // Load project GitHub config
  const { data: project } = await supabase
    .from("projects")
    .select("github_repo_owner, github_repo_name, github_installation_id")
    .eq("id", task.project_id as string)
    .maybeSingle();

  if (
    !project?.github_repo_owner ||
    !project?.github_repo_name ||
    !project?.github_installation_id
  ) {
    return NextResponse.json(
      { error: "project has no GitHub repository configured" },
      { status: 422 },
    );
  }

  // Resolve assignee github_handle
  let assigneeHandle: string | undefined;
  if (task.assignee_id) {
    const { data: member } = await supabase
      .from("team_members")
      .select("github_handle")
      .eq("id", task.assignee_id as string)
      .maybeSingle();
    if (member?.github_handle) assigneeHandle = member.github_handle as string;
  }

  // Load task tags for labels
  const { data: tagRows } = await supabase
    .from("task_tag_assignments")
    .select("task_tags(name)")
    .eq("task_id", body.task_id);

  const labels: string[] = [];
  for (const row of tagRows ?? []) {
    const tagName = (row as unknown as { task_tags: { name: string } | null }).task_tags?.name;
    if (tagName) labels.push(tagName);
  }

  // Create issue in GitHub
  let issue: Awaited<ReturnType<typeof createGitHubIssue>>;
  try {
    issue = await createGitHubIssue({
      installationId: project.github_installation_id as number,
      owner: project.github_repo_owner as string,
      repo: project.github_repo_name as string,
      title: task.title as string,
      body: (task.description as string | null) ?? "",
      labels,
      assignees: assigneeHandle ? [assigneeHandle] : [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: `GitHub API error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  // Save back to task
  await admin
    .from("tasks")
    .update({
      github_issue_number: issue.number,
      github_issue_url: issue.html_url,
      github_synced_at: new Date().toISOString(),
    })
    .eq("id", body.task_id);

  // Log activity
  await admin.from("activities").insert({
    entity_type: "task",
    entity_id: body.task_id,
    action: "github_issue_created",
    actor_type: "team",
    actor_id: user.id,
    metadata: { issue_number: issue.number, issue_url: issue.html_url },
  });

  return NextResponse.json({
    ok: true,
    issue_number: issue.number,
    issue_url: issue.html_url,
  });
}
