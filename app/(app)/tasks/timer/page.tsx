import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fmtDuration(minutes: number | null) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type EntryRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  description: string | null;
  is_billable: boolean;
  projects: { id: string; name: string } | null;
  tasks: { id: string; title: string } | null;
};

export default async function TimerHistoryPage() {
  const user = await requireUser();
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("time_entries")
    .select(
      "id, started_at, ended_at, duration_minutes, description, is_billable, projects(id, name), tasks:task_id(id, title)",
    )
    .eq("member_id", user.id)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(100);

  const entries = (data as unknown as EntryRow[]) ?? [];

  const totalMinutes = entries.reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Historial de tiempo"
        description={`${entries.length} registros · Total: ${fmtDuration(totalMinutes)}`}
        back={<BackLink href="/tasks" label="Tareas" />}
      />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyTitle>No hay registros de tiempo todavía.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                      Inicio
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                      Tarea / Proyecto
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                      Descripción
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                      Duración
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                      Facturable
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                        {fmtDatetime(e.started_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.tasks ? (
                          <a href={`/tasks/${e.tasks.id}`} className="font-medium hover:underline">
                            {e.tasks.title}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{e.projects?.name ?? "—"}</span>
                        )}
                        {e.projects && e.tasks && (
                          <p className="text-xs text-muted-foreground">{e.projects.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                        {e.description ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {e.ended_at ? (
                          fmtDuration(e.duration_minutes)
                        ) : (
                          <Badge variant="warning">Activo</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={e.is_billable ? "success" : "neutral"}>
                          {e.is_billable ? "Sí" : "No"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
