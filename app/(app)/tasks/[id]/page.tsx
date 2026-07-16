import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { mergeTaskMemberIds } from "@/lib/tasks/assignments";
import { TASK_STATUS } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GitHubModeBadge } from "../../projects/github-mode-badge";
import type { GitHubSyncMode } from "../../projects/github-sync-section";
import { syncTaskToGithub } from "../actions";
import { BranchCommand } from "./branch-command";
import { DeleteTaskButton } from "./delete-task-button";
import { type CommentItem, TaskComments } from "./task-comments";
import { TaskEditDialog } from "./task-edit-dialog";
import { TaskStatusSelect } from "./task-status-select";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createServerClient();

  const { data: task } = await supabase
    .from("tasks")
    .select(
      "*, projects(id, name, github_sync_mode, github_repo, github_repo_owner, github_repo_name, clients(id, name)), client:client_id(id, name), leads(id, name), team_members:assignee_id(id, name), creator:created_by(id, name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!task) notFound();

  type ProjectMeta = {
    id: string;
    name: string;
    github_sync_mode: GitHubSyncMode | null;
    github_repo: string | null;
    github_repo_owner: string | null;
    github_repo_name: string | null;
    clients: { id: string; name: string } | null;
  };
  const project = (task as unknown as { projects: ProjectMeta | null }).projects;
  const ghMode: GitHubSyncMode = project?.github_sync_mode ?? "none";
  const lead = (task as unknown as { leads: { id: string; name: string } | null }).leads;
  const directClient = (task as unknown as { client: { id: string; name: string } | null }).client;
  const assignee = (task as unknown as { team_members: { id: string; name: string } | null })
    .team_members;
  const creator = (task as unknown as { creator: { id: string; name: string } | null }).creator;
  const client = directClient ?? project?.clients ?? null;

  const [{ data: members }, { data: commentsData }, { data: taskMembersData }] = await Promise.all([
    supabase.from("team_members").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("task_comments")
      .select("id, body, created_at, author:author_id(id, name)")
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("task_members").select("member_id").eq("task_id", id),
  ]);
  const taskMemberIds = mergeTaskMemberIds(
    assignee?.id ?? null,
    (taskMembersData ?? []).map((m) => m.member_id as string),
  );
  const assignedMemberNames = taskMemberIds
    .map((memberId) => (members ?? []).find((member) => member.id === memberId)?.name)
    .filter((name): name is string => Boolean(name));

  const backHref = project ? `/projects/${project.id}/tasks` : "/tasks";
  const backLabel = project ? `Volver a ${project.name}` : "Volver a tareas";
  const canEdit = user.role !== "viewer";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={task.title as string}
        description={project?.name ?? lead?.name ?? undefined}
        back={<BackLink href={backHref} label={backLabel} />}
        actions={
          <div className="flex items-center gap-2">
            {canEdit ? (
              <TaskStatusSelect taskId={id} status={task.status as string} />
            ) : (
              <StatusBadge meta={TASK_STATUS} value={task.status as string} />
            )}
            {canEdit ? (
              <TaskEditDialog
                task={{
                  id: id,
                  title: task.title as string,
                  description: (task.description as string | null) ?? null,
                  status: task.status as string,
                  priority: task.priority as string,
                  member_ids: taskMemberIds,
                  due_date: (task.due_date as string | null) ?? null,
                }}
                members={(members ?? []) as Array<{ id: string; name: string }>}
              />
            ) : null}
            {canEdit ? <DeleteTaskButton taskId={id} /> : null}
          </div>
        }
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              {client ? (
                <DetailRow label="Cliente">
                  <Link href={`/clients/${client.id}`} className="hover:underline">
                    {client.name}
                  </Link>
                </DetailRow>
              ) : null}
              {project ? (
                  <DetailRow label="Proyecto">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      {project.name}
                    </Link>
                  </DetailRow>
              ) : null}
              {lead ? (
                <DetailRow label="Lead">
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.name}
                  </Link>
                </DetailRow>
              ) : null}
              <DetailRow label="Asignada">
                {assignedMemberNames.length > 0 ? assignedMemberNames.join(", ") : "—"}
              </DetailRow>
              <DetailRow label="Creada por">{creator?.name ?? "—"}</DetailRow>
              <DetailRow label="Vence">{formatDate(task.due_date as string | null)}</DetailRow>
              <DetailRow label="Iniciada">{formatDate(task.started_at as string | null)}</DetailRow>
              <DetailRow label="Completada">
                {formatDate(task.completed_at as string | null)}
              </DetailRow>
              {task.github_issue_url ? (
                <DetailRow label="GitHub">
                  <a
                    href={task.github_issue_url as string}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate hover:underline"
                  >
                    #{task.github_issue_number as number}
                  </a>
                </DetailRow>
              ) : null}
            </DetailGrid>
            {task.description ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Descripción
                </p>
                <p className="whitespace-pre-wrap text-sm">{task.description as string}</p>
              </div>
            ) : null}
            {ghMode !== "none" && project ? (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    GitHub
                  </p>
                  <GitHubModeBadge mode={ghMode} />
                </div>
                <TaskGithubActions
                  taskId={id}
                  mode={ghMode}
                  title={task.title as string}
                  body={(task.description as string | null) ?? ""}
                  issueUrl={(task.github_issue_url as string | null) ?? null}
                  issueNumber={(task.github_issue_number as number | null) ?? null}
                  branch={(task.github_branch as string | null) ?? null}
                  repoOwner={project.github_repo_owner}
                  repoName={project.github_repo_name}
                  repoUrl={project.github_repo}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Comments section */}
      {/* The TaskGithubActions block is defined below this component. */}
      <div className="mt-2">
        <SectionBoundary label="No se pudieron cargar los comentarios">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Comentarios</h2>
            <TaskComments
              taskId={id}
              memberId={user.id}
              memberRole={user.role}
              initialComments={(commentsData as unknown as CommentItem[]) ?? []}
            />
          </div>
        </SectionBoundary>
      </div>
    </div>
  );
}

function TaskGithubActions({
  taskId,
  mode,
  title,
  body,
  issueUrl,
  issueNumber,
  branch,
  repoOwner,
  repoName,
  repoUrl,
}: {
  taskId: string;
  mode: GitHubSyncMode;
  title: string;
  body: string;
  issueUrl: string | null;
  issueNumber: number | null;
  branch: string | null;
  repoOwner: string | null;
  repoName: string | null;
  repoUrl: string | null;
}) {
  if (mode === "link_only") {
    const base =
      repoOwner && repoName
        ? `https://github.com/${repoOwner}/${repoName}`
        : (repoUrl ?? "").replace(/\.git$/, "");
    if (!base) return null;
    const href = `${base}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-muted-foreground">
          Este proyecto es externo. Abriremos un nuevo issue en GitHub.com con la tarea precargada
          para que lo crees tú.
        </p>
        <Button asChild size="sm" variant="outline" className="w-fit">
          <a href={href} target="_blank" rel="noreferrer">
            Crear issue en GitHub
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
    );
  }

  if (issueUrl) {
    return (
      <div className="flex flex-col gap-3">
        <Button asChild size="sm" variant="outline" className="w-fit">
          <a href={issueUrl} target="_blank" rel="noreferrer">
            Ver issue #{issueNumber} en GitHub
            <ArrowUpRight className="size-3.5" />
          </a>
        </Button>
        {branch ? <BranchCommand branch={branch} /> : null}
      </div>
    );
  }

  return (
    <form action={syncTaskToGithub} className="flex flex-col gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <p className="text-[11px] text-muted-foreground">
        Aún no se ha creado el issue. La sincronización automática puede tardar; puedes forzarla
        manualmente.
      </p>
      <Button type="submit" size="sm" variant="outline" className="w-fit">
        Sincronizar con GitHub
      </Button>
    </form>
  );
}
