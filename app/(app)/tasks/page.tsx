import { ListControls } from "@/components/layout/list-controls";
import { ListPage } from "@/components/layout/list-page";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { TASK_PRIORITY, TASK_STATUS, type TaskPriority, type TaskStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { TaskCreateDialog } from "./task-create-dialog";
import { type KanbanTask, TasksKanban } from "./tasks-kanban";
import { TasksViewToggle } from "./view-toggle";

export const metadata: Metadata = { title: "Tareas · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = (Object.keys(TASK_STATUS) as TaskStatus[]).map((value) => ({
  value,
  label: TASK_STATUS[value].label,
}));

const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];
const PRIORITY_OPTIONS = PRIORITY_ORDER.map((value) => ({
  value,
  label: TASK_PRIORITY[value].label,
}));

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  projects: { id: string; name: string } | null;
  team_members: { id: string; name: string } | null;
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    project?: string;
    page?: string;
    view?: string;
  }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const view: "board" | "list" = sp.view === "list" ? "list" : "board";
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const priority = (sp.priority ?? "").trim();
  const projectId = (sp.project ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createServerClient();

  const [{ data: projects }, { data: leads }, { data: members }] = await Promise.all([
    supabase.from("projects").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("leads").select("id, name").is("deleted_at", null).order("created_at", {
      ascending: false,
    }),
    supabase.from("team_members").select("id, name").is("deleted_at", null).order("name"),
  ]);

  const projectsList = (projects ?? []) as Array<{ id: string; name: string }>;
  const leadsList = (leads ?? []) as Array<{ id: string; name: string }>;
  const membersList = (members ?? []) as Array<{ id: string; name: string }>;

  const PROJECT_OPTIONS = projectsList.map((p) => ({ value: p.id, label: p.name }));

  // Board view: fetch up to 200 active tasks without pagination.
  if (view === "board") {
    let bq = supabase
      .from("tasks")
      .select(
        "id, title, status, due_date, priority, projects(id, name), team_members:assignee_id(id, name)",
      )
      .is("deleted_at", null);
    if (q.length > 0) bq = bq.ilike("title", `%${escapeIlike(q)}%`);
    if (priority) bq = bq.eq("priority", priority);
    if (projectId) bq = bq.eq("project_id", projectId);

    const { data: boardData, error: boardErr } = await bq
      .order("kanban_order", { ascending: true, nullsFirst: false })
      .limit(200);

    type BoardRow = {
      id: string;
      title: string;
      status: KanbanTask["status"];
      priority: KanbanTask["priority"];
      due_date: string | null;
      projects: { id: string; name: string } | null;
      team_members: { id: string; name: string } | null;
    };
    const rawBoard = (boardData as unknown as BoardRow[]) ?? [];
    const capped = rawBoard.length >= 200;
    const tasks: KanbanTask[] = rawBoard.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      project: t.projects ? { id: t.projects.id, name: t.projects.name } : null,
      assignee_name: t.team_members?.name ?? null,
    }));

    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Tareas"
          description="Trabajo asignado al equipo, agrupado por proyecto y prioridad."
          actions={
            <div className="flex items-center gap-2">
              <TasksViewToggle view={view} />
              <TaskCreateDialog projects={projectsList} leads={leadsList} members={membersList} />
            </div>
          }
        />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ListControls
            searchKey="q"
            searchPlaceholder="Buscar por título…"
            filters={[
              { key: "project", label: "Proyecto", options: PROJECT_OPTIONS },
              { key: "priority", label: "Prioridad", options: PRIORITY_OPTIONS },
            ]}
            className="border-b-0"
          />
        </div>
        {boardErr ? (
          <p className="text-sm text-destructive">{boardErr.message}</p>
        ) : (
          <TasksKanban tasks={tasks} capped={capped} />
        )}
      </div>
    );
  }

  // List view (default).
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("tasks")
    .select(
      "id, title, status, due_date, priority, projects(id, name), team_members:assignee_id(id, name)",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (q.length > 0) query = query.ilike("title", `%${escapeIlike(q)}%`);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error, count } = await query
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .range(from, to);

  const rows = ((data as unknown as TaskRow[]) ?? []).map((t) => ({
    id: t.id,
    href: `/tasks/${t.id}`,
    cells: [
      t.title,
      t.projects ? (
        <Link key={`p-${t.id}`} href={`/projects/${t.projects.id}`} className="hover:underline">
          {t.projects.name}
        </Link>
      ) : (
        "—"
      ),
      <StatusBadge key={`s-${t.id}`} meta={TASK_STATUS} value={t.status} />,
      <StatusBadge key={`pr-${t.id}`} meta={TASK_PRIORITY} value={t.priority} />,
      t.team_members?.name ?? "—",
      formatDate(t.due_date),
    ],
  }));

  return (
    <ListPage
      title="Tareas"
      description="Trabajo asignado al equipo, agrupado por proyecto y prioridad."
      empty={q || status || priority || projectId ? "Sin coincidencias." : "Aún no hay tareas."}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por título…"
      filters={[
        { key: "project", label: "Proyecto", options: PROJECT_OPTIONS },
        { key: "status", label: "Estado", options: STATUS_OPTIONS },
        { key: "priority", label: "Prioridad", options: PRIORITY_OPTIONS },
      ]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      actions={
        <div className="flex items-center gap-2">
          <TasksViewToggle view={view} />
          <TaskCreateDialog projects={projectsList} leads={leadsList} members={membersList} />
        </div>
      }
      emptyAction={
        <TaskCreateDialog projects={projectsList} leads={leadsList} members={membersList} />
      }
      addHref="/tasks/new"
      addLabel="Nueva tarea"
      headers={["Título", "Proyecto", "Estado", "Prioridad", "Asignada", "Vence"]}
      rows={rows}
    />
  );
}
