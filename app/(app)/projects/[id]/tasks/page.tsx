import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type KanbanTask, TasksKanban } from "./tasks-kanban";

export const dynamic = "force-dynamic";

type TaskRow = {
  id: string;
  title: string;
  status: KanbanTask["status"];
  priority: KanbanTask["priority"];
  due_date: string | null;
  kanban_order: string;
  team_members: { id: string; name: string } | null;
};

export default async function ProjectKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) notFound();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, kanban_order, team_members:assignee_id(id, name)",
    )
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("kanban_order", { ascending: true });

  const kanbanTasks: KanbanTask[] = ((tasks as unknown as TaskRow[]) ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    kanban_order: t.kanban_order,
    assignee: t.team_members,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${project.name as string} · Kanban`}
        description="Arrastra tareas entre columnas para cambiar su estado."
        back={<BackLink href={`/projects/${id}`} label="Volver al proyecto" />}
        actions={
          <Button asChild size="sm">
            <Link href={`/tasks/new?project_id=${id}`}>
              <Plus className="h-4 w-4" />
              Nueva tarea
            </Link>
          </Button>
        }
      />

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error.message}</p>
          </CardContent>
        </Card>
      ) : kanbanTasks.length === 0 ? (
        <Card>
          <CardContent className="px-0 pt-0">
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Aún no hay tareas en este proyecto.</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild size="sm">
                  <Link href={`/tasks/new?project_id=${id}`}>
                    <Plus className="h-4 w-4" />
                    Crear primera tarea
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <TasksKanban tasks={kanbanTasks} />
      )}
    </div>
  );
}
