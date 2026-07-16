import { ListControls } from "@/components/layout/list-controls";
import { ListPage } from "@/components/layout/list-page";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { TASK_PRIORITY, TASK_STATUS, type TaskPriority, type TaskStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { listTasksBoard, listTasksList } from "@/lib/tasks/queries";
import { TASK_LIST_PAGE_SIZE, TASK_SORT_COLUMNS } from "@/lib/tasks/types";
import { formatDate } from "@/lib/utils";
import { parsePage, parseSortParam, parseStringParam } from "@/lib/utils/search-params";
import type { Metadata } from "next";
import Link from "next/link";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskRowActions } from "./task-row-actions";
import { type KanbanTask, TasksKanban } from "./tasks-kanban";
import { TasksViewToggle } from "./view-toggle";

export const metadata: Metadata = { title: "Tareas · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = (Object.keys(TASK_STATUS) as TaskStatus[]).map((value) => ({
  value,
  label: TASK_STATUS[value].label,
}));

const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];
const PRIORITY_OPTIONS = PRIORITY_ORDER.map((value) => ({
  value,
  label: TASK_PRIORITY[value].label,
}));

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const view: "board" | "list" = parseStringParam(sp, "view") === "list" ? "list" : "board";
  const q = parseStringParam(sp, "q");
  const status = parseStringParam(sp, "status");
  const priority = parseStringParam(sp, "priority");
  const projectId = parseStringParam(sp, "project");
  const page = parsePage(sp);
  const { sort, dir } = parseSortParam(sp, TASK_SORT_COLUMNS, "priority", "desc");

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

  if (view === "board") {
    const { items, capped, error: boardErr } = await listTasksBoard({ q, priority, projectId });
    const tasks = items as KanbanTask[];

    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Tareas"
          description="Trabajo asignado al equipo, agrupado por proyecto y prioridad."
          actions={
            <div className="flex items-center gap-2">
              <TasksViewToggle view={view} />
              <TaskCreateDialog
                projects={projectsList}
                leads={leadsList}
                members={membersList}
                currentUserId={user.id}
              />
            </div>
          }
        />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ListControls
            searchKey="q"
            searchPlaceholder="Buscar por título…"
            filters={[
              { key: "project", label: "Proyecto", options: PROJECT_OPTIONS, searchable: true },
              { key: "priority", label: "Prioridad", options: PRIORITY_OPTIONS },
            ]}
            className="border-b-0"
          />
        </div>
        {boardErr ? (
          <p className="text-sm text-destructive">{boardErr}</p>
        ) : (
          <TasksKanban
            tasks={tasks}
            capped={capped}
            projects={projectsList}
            leads={leadsList}
            members={membersList}
            currentUserId={user.id}
          />
        )}
      </div>
    );
  }

  const { data, count, error } = await listTasksList({
    q,
    status,
    priority,
    projectId,
    page,
    sort,
    dir,
  });

  const rows = data.map((t) => ({
    id: t.id,
    href: `/tasks/${t.id}`,
    csvValues: [
      t.title,
      t.projects?.name ?? "",
      t.status,
      t.priority,
      t.team_members?.name ?? "",
      t.due_date ?? "",
    ],
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
      <TaskRowActions key={`a-${t.id}`} taskId={t.id} status={t.status} />,
    ],
  }));

  return (
    <ListPage
      title="Tareas"
      description="Trabajo asignado al equipo, agrupado por proyecto y prioridad."
      empty={q || status || priority || projectId ? "Sin coincidencias." : "Aún no hay tareas."}
      error={error ?? undefined}
      searchKey="q"
      searchPlaceholder="Buscar por título…"
      filters={[
        { key: "project", label: "Proyecto", options: PROJECT_OPTIONS },
        { key: "status", label: "Estado", options: STATUS_OPTIONS },
        { key: "priority", label: "Prioridad", options: PRIORITY_OPTIONS },
      ]}
      pagination={{ page, pageSize: TASK_LIST_PAGE_SIZE, total: count }}
      actions={
        <div className="flex items-center gap-2">
          <TasksViewToggle view={view} />
          <TaskCreateDialog
            projects={projectsList}
            leads={leadsList}
            members={membersList}
            currentUserId={user.id}
          />
        </div>
      }
      emptyAction={
        <TaskCreateDialog
          projects={projectsList}
          leads={leadsList}
          members={membersList}
          currentUserId={user.id}
        />
      }
      addHref="/tasks/new"
      addLabel="Nueva tarea"
      headers={[
        { label: "Título", sortKey: "title" },
        "Proyecto",
        { label: "Estado", sortKey: "status" },
        { label: "Prioridad", sortKey: "priority" },
        "Asignada",
        { label: "Vence", sortKey: "due_date" },
        "",
      ]}
      align={["left", "left", "left", "left", "left", "left", "right"]}
      exportFilename="tareas"
      rows={rows}
    />
  );
}
