import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { INVOICE_STATUS, PROJECT_STATUS, PROPOSAL_STATUS } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GitHubModeBadge } from "../github-mode-badge";
import type { GitHubSyncMode } from "../github-sync-section";
import { ProjectEditDialog } from "./project-edit-dialog";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) notFound();

  const client = (project as unknown as { clients: { id: string; name: string } | null }).clients;

  const canEdit = user.role !== "viewer";
  const { data: clients } = canEdit
    ? await supabase.from("clients").select("id, name").is("deleted_at", null).order("name")
    : { data: null as Array<{ id: string; name: string }> | null };

  const [{ data: tasks }, { data: proposals }, { data: invoices }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("proposals")
      .select("id, number, title, status, total")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("invoices")
      .select("id, full_number, status, total, issue_date")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.name as string}
        description={client?.name}
        breadcrumbs={[
          { label: "Proyectos", href: "/projects" },
          ...(client ? [{ label: client.name, href: `/clients/${client.id}` }] : []),
          { label: project.name as string },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <GitHubModeBadge
              mode={(project.github_sync_mode as GitHubSyncMode | null) ?? "none"}
            />
            <StatusBadge meta={PROJECT_STATUS} value={project.status as string} />
            {canEdit ? (
              <ProjectEditDialog
                project={{
                  id: project.id as string,
                  client_id: (client?.id as string | undefined) ?? "",
                  name: project.name as string,
                  status: project.status as string,
                  starts_at: (project.starts_at as string | null) ?? null,
                  ends_at: (project.ends_at as string | null) ?? null,
                  description: (project.description as string | null) ?? null,
                  github_sync_mode:
                    (project.github_sync_mode as GitHubSyncMode | null) ?? "none",
                  github_repo: (project.github_repo as string | null) ?? null,
                  github_installation_id:
                    (project.github_installation_id as number | null) ?? null,
                  github_auto_sync: (project.github_auto_sync as boolean | null) ?? true,
                }}
                clients={clients ?? []}
              />
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailRow label="Cliente">
              {client ? (
                <Link href={`/clients/${client.id}`} className="hover:underline">
                  {client.name}
                </Link>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Estado">{project.status as string}</DetailRow>
            <DetailRow label="Inicio">{formatDate(project.starts_at as string | null)}</DetailRow>
            <DetailRow label="Fin previsto">
              {formatDate(project.ends_at as string | null)}
            </DetailRow>
            {project.github_repo ? (
              <DetailRow label="Repositorio">
                <a
                  href={project.github_repo as string}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {project.github_repo as string}
                </a>
              </DetailRow>
            ) : null}
          </DetailGrid>
          {project.description ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descripción
              </p>
              <p className="whitespace-pre-wrap text-sm">{project.description as string}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline">
          <Link href={`/projects/${id}/milestones`}>Ver hitos</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tareas</CardTitle>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${id}/tasks`}>Ver Kanban</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/tasks/new?project_id=${id}`}>Nueva tarea</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {!tasks || tasks.length === 0 ? (
            <p className="px-6 py-2 text-sm text-muted-foreground">Sin tareas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li
                  key={t.id as string}
                  className="flex items-center justify-between px-6 py-2.5 text-sm"
                >
                  <Link href={`/tasks/${t.id as string}`} className="font-medium hover:underline">
                    {t.title as string}
                  </Link>
                  <span className="text-xs text-muted-foreground">{t.status as string}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Proposals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Propuestas</CardTitle>
            {client ? (
              <Button asChild size="sm">
                <Link href={`/proposals/new?client_id=${client.id}&project_id=${id}`}>Nueva</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="px-0">
            {!proposals || proposals.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin propuestas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {proposals.map((p) => (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/proposals/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.number as string}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge meta={PROPOSAL_STATUS} value={p.status as string} />
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatEUR(Number(p.total ?? 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!invoices || invoices.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin facturas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.map((inv) => (
                  <li
                    key={inv.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {inv.full_number as string}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge meta={INVOICE_STATUS} value={inv.status as string} />
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatEUR(Number(inv.total ?? 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
