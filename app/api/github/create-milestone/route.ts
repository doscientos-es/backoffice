/**
 * POST /api/github/create-milestone
 *
 * Syncs a CRM milestone to a GitHub milestone and saves the link back.
 * Body: { milestone_id: string }
 *
 * Steps (sec. 19.2):
 *   1. Load milestone + project GitHub config
 *   2. Create milestone in GitHub
 *   3. Save github_milestone_number to the milestone row
 */

import { requireUser } from "@/lib/auth";
import { createGitHubMilestone } from "@/lib/integrations/github";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  milestone_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "milestone_id is required and must be a UUID" },
      { status: 400 },
    );
  }

  const supabase = await createServerClient();
  const admin = createAdminClient();

  // Load milestone (table is `milestones`, see step7 migration).
  const { data: milestone, error: milErr } = await supabase
    .from("milestones")
    .select("id, name, due_date, project_id, github_milestone_number")
    .eq("id", body.milestone_id)
    .maybeSingle();

  if (milErr || !milestone) {
    return NextResponse.json({ error: "milestone not found" }, { status: 404 });
  }

  if (milestone.github_milestone_number) {
    return NextResponse.json(
      {
        error: "milestone already synced to GitHub",
        github_milestone_number: milestone.github_milestone_number,
      },
      { status: 409 },
    );
  }

  if (!milestone.project_id) {
    return NextResponse.json({ error: "milestone has no linked project" }, { status: 422 });
  }

  // Load project GitHub config — only bidirectional projects may push to GitHub.
  const { data: project } = await supabase
    .from("projects")
    .select(
      "github_sync_mode, github_repo_owner, github_repo_name, github_installation_id",
    )
    .eq("id", milestone.project_id as string)
    .maybeSingle();

  if (!project || project.github_sync_mode !== "bidirectional") {
    return NextResponse.json(
      {
        error:
          "project is not in bidirectional GitHub sync mode — el backoffice no puede crear milestones en este repositorio",
      },
      { status: 409 },
    );
  }

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

  // Create milestone in GitHub
  let ghMilestone: Awaited<ReturnType<typeof createGitHubMilestone>>;
  try {
    // GitHub expects ISO 8601 datetime for due_on (T00:00:00Z suffix)
    const dueOn = milestone.due_date ? `${milestone.due_date as string}T00:00:00Z` : undefined;

    ghMilestone = await createGitHubMilestone({
      installationId: project.github_installation_id as number,
      owner: project.github_repo_owner as string,
      repo: project.github_repo_name as string,
      title: milestone.name as string,
      dueOn,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `GitHub API error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  // Save link back
  await admin
    .from("project_milestones")
    .update({ github_milestone_number: ghMilestone.number })
    .eq("id", body.milestone_id);

  return NextResponse.json({
    ok: true,
    github_milestone_number: ghMilestone.number,
    github_milestone_url: ghMilestone.html_url,
  });
}
