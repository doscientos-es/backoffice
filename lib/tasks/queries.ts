import { scopedLogger } from "@/lib/logger";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import {
  TASK_BOARD_LIMIT,
  TASK_LIST_PAGE_SIZE,
  type TaskBoardItem,
  type TaskBoardParams,
  type TaskDetailResult,
  type TaskListItem,
  type TaskListParams,
  type TaskListResult,
} from "./types";

const log = scopedLogger("tasks.queries");

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export async function listTasksBoard(params: TaskBoardParams): Promise<TaskBoardItem[]> {
  const supabase = await createServerClient();

  let query = notDeleted(
    supabase
      .from("tasks")
      .select(
        "id, title, status, due_date, priority, projects(id, name), team_members:assignee_id(id, name)",
      ),
  );

  if (params.q && params.q.length > 0) query = query.ilike("title", `%${escapeIlike(params.q)}%`);
  if (params.priority) query = query.eq("priority", params.priority);

  const { data, error } = await query
    .order("kanban_order", { ascending: true, nullsFirst: false })
    .limit(TASK_BOARD_LIMIT);

  if (error) log.error({ err: error.message }, "list_tasks_board_failed");

  type Row = {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    projects: { id: string; name: string } | null;
    team_members: { id: string; name: string } | null;
  };

  return ((data as unknown as Row[]) ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    project: t.projects ? { id: t.projects.id, name: t.projects.name } : null,
    assignee_name: t.team_members?.name ?? null,
  }));
}

export async function listTasksList(params: TaskListParams): Promise<TaskListResult> {
  const supabase = await createServerClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * TASK_LIST_PAGE_SIZE;
  const to = from + TASK_LIST_PAGE_SIZE - 1;

  let query = notDeleted(
    supabase
      .from("tasks")
      .select(
        "id, title, status, due_date, priority, projects(id, name), milestones(id, name), team_members:assignee_id(id, name)",
        { count: "exact" },
      ),
  );

  if (params.q && params.q.length > 0) query = query.ilike("title", `%${escapeIlike(params.q)}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.priority) query = query.eq("priority", params.priority);

  const { data, error, count } = await query
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (error) log.error({ err: error.message }, "list_tasks_list_failed");

  return {
    data: (data as unknown as TaskListItem[]) ?? [],
    count: count ?? 0,
  };
}

export async function getTaskDetail(id: string): Promise<TaskDetailResult> {
  const supabase = await createServerClient();

  const { data: task, error } = await notDeleted(
    supabase
      .from("tasks")
      .select(
        "*, projects(id, name, github_sync_mode, github_repo, github_repo_owner, github_repo_name), leads(id, name), milestones(id, name), team_members:assignee_id(id, name), creator:created_by(id, name)",
      )
      .eq("id", id),
  ).maybeSingle();

  if (error) log.error({ taskId: id, err: error.message }, "get_task_detail_failed");
  if (!task) return null;

  const [{ data: members }, { data: milestones }, { data: commentsData }] = await Promise.all([
    notDeleted(supabase.from("team_members").select("id, name")).order("name"),
    (() => {
      const project = (task as unknown as { projects: { id: string } | null }).projects;
      return project?.id
        ? notDeleted(
            supabase.from("milestones").select("id, name").eq("project_id", project.id),
          ).order("due_date", { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> });
    })(),
    supabase
      .from("task_comments")
      .select("id, body, created_at, author:author_id(id, name)")
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
  ]);

  type AnyRecord = Record<string, unknown>;
  const raw = task as unknown as AnyRecord;
  const project = (raw.projects as { id: string; name: string; github_sync_mode: string | null; github_repo: string | null; github_repo_owner: string | null; github_repo_name: string | null } | null) ?? null;
  const lead = (raw.leads as { id: string; name: string } | null) ?? null;
  const assignee = (raw.team_members as { id: string; name: string } | null) ?? null;
  const creator = (raw.creator as { id: string; name: string } | null) ?? null;

  return {
    task: {
      id: task.id as string,
      title: task.title as string,
      description: (task.description as string | null) ?? null,
      status: task.status as string,
      priority: task.priority as string,
      milestone_id: (task.milestone_id as string | null) ?? null,
      due_date: (task.due_date as string | null) ?? null,
      started_at: (task.started_at as string | null) ?? null,
      completed_at: (task.completed_at as string | null) ?? null,
      github_issue_url: (task.github_issue_url as string | null) ?? null,
      github_issue_number: (task.github_issue_number as number | null) ?? null,
    },
    project,
    lead,
    assignee,
    creator,
    members: (members ?? []) as Array<{ id: string; name: string }>,
    milestones: (milestones ?? []) as Array<{ id: string; name: string }>,
    comments: (commentsData as unknown as Array<{ id: string; body: string; created_at: string; author: { id: string; name: string } | null }>) ?? [],
  };
}
