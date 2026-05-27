import { ListPage } from "@/components/layout/list-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TASK_PRIORITY, TASK_STATUS, type TaskPriority, type TaskStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { type KanbanTask, TasksKanban } from "./tasks-kanban";
import { TasksViewToggle } from "./view-toggle";

export const metadata = { title: "Tareas · doscientos" };
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
  milestones: { id: string; name: string } | null;
  team_members: { id: string; name: string } | null;
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    page?: string;
    view?: string;
  }>;
}) {
  const sp = await searchParams;
  const view: "board" | "list" = sp.view === "board" ? "board" : "list";
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const priority = (sp.priority ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createServerClient();

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
    const tasks: KanbanTask[] = ((boardData as unknown as BoardRow[]) ?? []).map((t) => ({
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
              <Button asChild size="sm">
                <Link href="/tasks/new">
                  <Plus className="h-4 w-4" />
                  Nueva tarea
                </Link>
              </Button>
            </div>
          }
        />
        {boardErr ? (
          <p className="text-sm text-destructive">{boardErr.message}</p>
        ) : (
          <TasksKanban tasks={tasks} />
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
      "id, title, status, due_date, priority, projects(id, name), milestones(id, name), team_members:assignee_id(id, name)",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (q.length > 0) query = query.ilike("title", `%${escapeIlike(q)}%`);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);

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
      t.milestones?.name ?? "—",
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
      empty={q || status || priority ? "Sin coincidencias." : "Aún no hay tareas."}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por título…"
      filters={[
        { key: "status", label: "Estado", options: STATUS_OPTIONS },
        { key: "priority", label: "Prioridad", options: PRIORITY_OPTIONS },
      ]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      actions={
        <div className="flex items-center gap-2">
          <TasksViewToggle view={view} />
          <Button asChild size="sm">
            <Link href="/tasks/new">
              <Plus className="h-4 w-4" />
              Nueva tarea
            </Link>
          </Button>
        </div>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/tasks/new">
            <Plus className="h-4 w-4" />
            Crear primera tarea
          </Link>
        </Button>
      }
      addHref="/tasks/new"
      addLabel="Nueva tarea"
      headers={["Título", "Proyecto", "Hito", "Estado", "Prioridad", "Asignada", "Vence"]}
      rows={rows}
    />
  );
}
