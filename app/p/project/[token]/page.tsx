import { CalendarDays, CircleCheck, CircleDot, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalPasswordGate } from "@/components/portal/password-gate";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { isPortalUnlocked } from "@/lib/portal/access";
import { PROJECT_STATUS, TASK_STATUS } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { unlockProjectPortal } from "./actions";
import { ProjectRequestForm } from "./request-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seguimiento del proyecto · doscientos",
  robots: { index: false, follow: false },
};

const REQUEST_STATUS: Record<string, string> = {
  new: "Recibida",
  in_progress: "En curso",
  resolved: "Resuelta",
  closed: "Cerrada",
};

export default async function ProjectPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const auth = await getCurrentUser();
  const isTeam = auth.ok;

  const { data: project } = await admin
    .from("projects")
    .select(
      "id, name, status, starts_at, ends_at, portal_password_hash, is_client_visible, clients(name)",
    )
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) notFound();

  if (!isTeam) {
    if (project.is_client_visible === false) notFound();
    const unlocked = await isPortalUnlocked(
      token,
      (project.portal_password_hash as string | null) ?? null,
    );
    if (!unlocked) {
      return <PortalPasswordGate token={token} action={unlockProjectPortal} />;
    }
  }

  const [{ data: tasks }, { data: requests }] = await Promise.all([
    admin
      .from("tasks")
      .select("id, title, status, due_date, completed_at")
      .eq("project_id", project.id as string)
      .eq("kind", "task")
      .eq("is_client_visible", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("project_requests")
      .select("id, subject, category, status, created_at")
      .eq("project_id", project.id as string)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const visibleTasks = (tasks ?? []).filter((task) => task.status !== "cancelled");
  const completed = visibleTasks.filter((task) => task.status === "done").length;
  const progress =
    visibleTasks.length === 0 ? 0 : Math.round((completed / visibleTasks.length) * 100);
  const client = (project as unknown as { clients: { name: string } | null }).clients;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {isTeam && project.is_client_visible === false ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Vista previa interna. Este portal todavía está oculto para el cliente.
        </div>
      ) : null}

      <header className="rounded-2xl bg-zinc-950 px-5 py-7 text-white shadow-sm sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          {client?.name ?? "Proyecto"}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {project.name as string}
          </h1>
          <StatusBadge meta={PROJECT_STATUS} value={project.status as string} />
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>Progreso de las tareas compartidas</span>
            <strong>{progress}%</strong>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {completed} de {visibleTasks.length} tareas completadas
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard label="Inicio" value={formatDate(project.starts_at as string | null)} />
        <InfoCard label="Entrega prevista" value={formatDate(project.ends_at as string | null)} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <CircleCheck className="size-5 text-emerald-600" /> Estado del trabajo
        </h2>
        {visibleTasks.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Todavía no hay tareas compartidas.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibleTasks.map((task) => (
              <li key={task.id as string} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CircleDot className="size-4 shrink-0 text-zinc-400" />
                  <span className="truncate text-sm font-medium">{task.title as string}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {task.due_date ? (
                    <span className="hidden text-xs text-zinc-500 sm:inline">
                      {formatDate(task.due_date as string)}
                    </span>
                  ) : null}
                  <StatusBadge meta={TASK_STATUS} value={task.status as string} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <MessageSquareText className="size-5 text-violet-600" /> Solicitudes
        </h2>
        {(requests ?? []).length > 0 ? (
          <ul className="mt-4 grid gap-2">
            {(requests ?? []).map((request) => (
              <li key={request.id as string} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{request.subject as string}</span>
                  <span className="text-xs text-zinc-500">
                    {REQUEST_STATUS[request.status as string] ?? (request.status as string)} ·{" "}
                    {formatDate(request.created_at as string)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No hay solicitudes abiertas.</p>
        )}
        <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />
        <h3 className="mb-4 text-sm font-semibold">Enviar una nueva solicitud</h3>
        <ProjectRequestForm token={token} />
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
      <CalendarDays className="size-5 text-zinc-400" />
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
