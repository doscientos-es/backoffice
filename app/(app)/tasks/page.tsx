import { ListPage } from "@/components/layout/list-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Tareas · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  todo: "neutral",
  in_progress: "info",
  in_review: "warning",
  done: "success",
  cancelled: "danger",
} as const;

const STATUS_LABEL: Record<string, string> = {
  todo: "Por hacer",
  in_progress: "En curso",
  in_review: "Revisión",
  done: "Terminada",
  cancelled: "Cancelada",
};

const PRIORITY_VARIANT = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
} as const;

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

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

export default async function TasksPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, status, due_date, priority, projects(id, name), milestones(id, name), team_members:assignee_id(id, name)",
    )
    .is("deleted_at", null)
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);

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
      <Badge key={`s-${t.id}`} variant={STATUS_VARIANT[t.status as keyof typeof STATUS_VARIANT]}>
        {STATUS_LABEL[t.status] ?? t.status}
      </Badge>,
      <Badge
        key={`pr-${t.id}`}
        variant={PRIORITY_VARIANT[t.priority as keyof typeof PRIORITY_VARIANT]}
      >
        {PRIORITY_LABEL[t.priority] ?? t.priority}
      </Badge>,
      t.team_members?.name ?? "—",
      formatDate(t.due_date),
    ],
  }));

  return (
    <ListPage
      title="Tareas"
      description="Trabajo asignado al equipo, agrupado por proyecto y prioridad."
      empty="Aún no hay tareas."
      error={error?.message}
      actions={
        <Button asChild size="sm">
          <Link href="/tasks/new">
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Link>
        </Button>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/tasks/new">
            <Plus className="h-4 w-4" />
            Crear primera tarea
          </Link>
        </Button>
      }
      headers={["Título", "Proyecto", "Hito", "Estado", "Prioridad", "Asignada", "Vence"]}
      rows={rows}
    />
  );
}
