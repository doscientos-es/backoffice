import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { AttachmentSection } from "@/components/ui/attachment-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopySummaryButton } from "@/components/ui/copy-summary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { githubDefaultInstallationId } from "@/lib/env";
import { computeProjectProfitability } from "@/lib/finance";
import { INVOICE_STATUS, PROJECT_STATUS, PROPOSAL_STATUS } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskCreateDialog } from "../../tasks/task-create-dialog";
import { GitHubModeBadge } from "../github-mode-badge";
import type { GitHubSyncMode } from "../github-sync-section";
import { type ChecklistItemRow, ChecklistSection } from "./checklist-section";
import { DeleteProjectButton } from "./delete-project-button";
import { MonthlyInvoiceSection } from "./monthly-invoice-section";
import { ProjectEditDialog } from "./project-edit-dialog";
import { ProjectTasksViewToggle } from "./project-tasks-view-toggle";
import { type KanbanTask, TasksKanban } from "./tasks/tasks-kanban";
import { type WorkLogRow, WorkLogSection } from "./work-log-section";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tasks_view?: string }>;
}) {
  const { id } = await params;
  const { tasks_view } = await searchParams;
  const isBoard = tasks_view === "board";
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

  const [
    { data: tasks },
    { data: proposals },
    { data: invoices },
    { data: members },
    { data: attachments },
    { data: workLogsData },
    { data: invoiceTotals },
    { data: expenseTotals },
    { data: settings },
    { data: checklistData },
    { data: unlinkdProposals },
  ] = await Promise.all([
    isBoard
      ? supabase
        .from("tasks")
        .select(
          "id, title, status, priority, due_date, kanban_order, team_members:assignee_id(id, name)",
        )
        .eq("project_id", id)
        .is("deleted_at", null)
        .order("kanban_order", { ascending: true })
      : supabase
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
    supabase.from("team_members").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("attachments")
      .select("id, name, mime_type, size_bytes, created_at")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("work_logs")
      .select(
        "id, work_date, start_time, end_time, hours, note, team_members:member_id(id, name, avatar_url, github_handle)",
      )
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("work_date", { ascending: false }),
    supabase.from("invoices").select("total, status").eq("project_id", id).is("deleted_at", null),
    supabase
      .from("expenses")
      .select("total")
      .eq("project_id", id)
      .is("deleted_at", null)
      .neq("status", "cancelled"),
    supabase.from("settings").select("internal_hourly_cost").eq("id", 1).maybeSingle(),
    supabase
      .from("project_checklist_items")
      .select("id, label, is_done, position")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("position"),
    // Proposals from the same client that are not yet linked to any project.
    client
      ? supabase
        .from("proposals")
        .select("id, number, title")
        .eq("client_id", client.id)
        .is("project_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const workLogs: WorkLogRow[] = ((workLogsData ?? []) as Array<Record<string, unknown>>).map(
    (w) => {
      const m = w.team_members as {
        name: string;
        avatar_url: string | null;
        github_handle: string | null;
      } | null;
      return {
        id: w.id as string,
        work_date: w.work_date as string,
        start_time: ((w.start_time as string | null) ?? null)?.slice(0, 5) ?? null,
        end_time: ((w.end_time as string | null) ?? null)?.slice(0, 5) ?? null,
        hours: Number(w.hours) || 0,
        note: (w.note as string | null) ?? null,
        member: m
          ? {
            name: m.name,
            avatar_url: m.avatar_url ?? null,
            github_handle: m.github_handle ?? null,
          }
          : null,
      };
    },
  );
  const invoicedTotal = ((invoiceTotals ?? []) as Array<{ total: number | string | null }>).reduce(
    (sum, r) => sum + Number(r.total ?? 0),
    0,
  );

  // Profitability: revenue excludes drafts/cancelled, hours are valued with the
  // company-wide internal hourly cost (Ajustes › Empresa), expenses exclude cancelled.
  const computableRevenue = (
    (invoiceTotals ?? []) as Array<{ total: number | string | null; status: string | null }>
  )
    .filter((r) => r.status !== "draft" && r.status !== "cancelled")
    .reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const expensesTotal = ((expenseTotals ?? []) as Array<{ total: number | string | null }>).reduce(
    (sum, r) => sum + Number(r.total ?? 0),
    0,
  );
  const profitability = computeProjectProfitability({
    revenue: computableRevenue,
    hours: workLogs.reduce((sum, w) => sum + w.hours, 0),
    hourlyCost: Number(
      (settings as { internal_hourly_cost?: number | string | null } | null)
        ?.internal_hourly_cost ?? 0,
    ),
    expenses: expensesTotal,
  });

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
            <CopySummaryButton
              lines={(() => {
                const parts: string[] = [];
                parts.push(
                  [`🗂️ ${project.name as string}`, client && `— ${client.name}`]
                    .filter(Boolean)
                    .join(" "),
                );
                parts.push(
                  [
                    `Estado: ${PROJECT_STATUS[project.status as keyof typeof PROJECT_STATUS]?.label ?? project.status}`,
                    (project.billing_type as string | null) &&
                    `Facturación: ${project.billing_type as string}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                );
                const dates = [
                  (project.starts_at as string | null) &&
                  `Inicio: ${formatDate(project.starts_at as string)}`,
                  (project.ends_at as string | null) &&
                  `Fin: ${formatDate(project.ends_at as string)}`,
                ].filter(Boolean);
                if (dates.length) parts.push(dates.join(" · "));
                return parts;
              })()}
              urlPath={`/projects/${id}`}
            />
            <GitHubModeBadge mode={(project.github_sync_mode as GitHubSyncMode | null) ?? "none"} />
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
                  billing_type: (project.billing_type as "fixed" | "hourly" | null) ?? "fixed",
                  hourly_rate: project.hourly_rate != null ? Number(project.hourly_rate) : null,
                  hourly_vat_rate:
                    project.hourly_vat_rate != null ? Number(project.hourly_vat_rate) : null,
                  github_sync_mode: (project.github_sync_mode as GitHubSyncMode | null) ?? "none",
                  github_repo: (project.github_repo as string | null) ?? null,
                  github_installation_id: (project.github_installation_id as number | null) ?? null,
                  github_auto_sync: (project.github_auto_sync as boolean | null) ?? true,
                }}
                clients={clients ?? []}
                orgDefaultInstallationId={githubDefaultInstallationId()}
              />
            ) : null}
            {canEdit ? <DeleteProjectButton projectId={project.id as string} /> : null}
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tareas</CardTitle>
          <div className="flex items-center gap-2">
            <ProjectTasksViewToggle view={isBoard ? "board" : "list"} />
            <TaskCreateDialog
              projectId={id}
              members={(members ?? []) as Array<{ id: string; name: string }>}
            />
          </div>
        </CardHeader>
        <CardContent className={isBoard ? "px-4 pb-4 pt-0" : "px-0"}>
          {!tasks || tasks.length === 0 ? (
            <p className="px-6 py-2 text-sm text-muted-foreground">Sin tareas.</p>
          ) : isBoard ? (
            <TasksKanban
              tasks={(
                tasks as unknown as Array<{
                  id: string;
                  title: string;
                  status: KanbanTask["status"];
                  priority: KanbanTask["priority"];
                  due_date: string | null;
                  kanban_order: string;
                  team_members: { id: string; name: string } | null;
                }>
              ).map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                due_date: t.due_date,
                kanban_order: t.kanban_order,
                assignee: t.team_members,
              }))}
            />
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

      <WorkLogSection
        projectId={id}
        logs={workLogs}
        invoicedTotal={invoicedTotal}
        billingType={(project.billing_type as "fixed" | "hourly" | null) ?? "fixed"}
        hourlyRate={project.hourly_rate != null ? Number(project.hourly_rate) : null}
        canEdit={canEdit}
      />

      {canEdit && project.billing_type === "hourly" && Number(project.hourly_rate ?? 0) > 0 ? (
        <MonthlyInvoiceSection
          projectId={id}
          hourlyRate={Number(project.hourly_rate)}
          hourlyVatRate={Number(project.hourly_vat_rate ?? 0)}
        />
      ) : null}

      <ChecklistSection
        projectId={id}
        items={(checklistData as ChecklistItemRow[] | null) ?? []}
        canEdit={canEdit}
      />

      <Card>
        <CardHeader>
          <CardTitle>Rentabilidad</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <ProfitStat label="Ingresos" value={formatEUR(profitability.revenue)} />
            <ProfitStat
              label="Horas"
              value={
                Number.isInteger(profitability.hours)
                  ? `${profitability.hours} h`
                  : `${profitability.hours.toFixed(2)} h`
              }
            />
            <ProfitStat label="Coste/h interno" value={formatEUR(profitability.hourlyCost)} />
            <ProfitStat label="Coste horas" value={formatEUR(profitability.laborCost)} />
            <ProfitStat label="Gastos" value={formatEUR(profitability.expenses)} />
            <ProfitStat label="Coste total" value={formatEUR(profitability.totalCost)} />
          </dl>
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Margen
              </dt>
              <dd
                className={`mt-1 text-2xl font-semibold tabular-nums ${profitability.margin >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
                  }`}
              >
                {formatEUR(profitability.margin)}
                {profitability.marginPct !== null ? (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    {profitability.marginPct}%
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                €/h efectivo
              </dt>
              <dd className="mt-1 text-lg font-medium tabular-nums">
                {profitability.effectiveRate !== null
                  ? `${formatEUR(profitability.effectiveRate)}/h`
                  : "—"}
              </dd>
            </div>
          </div>
          {profitability.hourlyCost === 0 ? (
            <p className="text-xs text-muted-foreground">
              Configura el{" "}
              <Link href="/settings/company" className="text-primary hover:underline">
                coste/hora interno
              </Link>{" "}
              para valorar las horas en el margen.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Proposals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Propuestas</CardTitle>
            <div className="flex items-center gap-2">
              <LinkProposalButton
                projectId={id}
                unlinkdProposals={
                  (unlinkdProposals ?? []) as {
                    id: string;
                    number: string | null;
                    title: string | null;
                  }[]
                }
              />
              {client ? (
                <Button asChild size="sm">
                  <Link href={`/proposals/new?client_id=${client.id}&project_id=${id}`}>Nueva</Link>
                </Button>
              ) : null}
            </div>
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

        <AttachmentSection
          entityType="project"
          entityId={id}
          attachments={
            (attachments ?? []) as import("@/components/ui/attachment-section").AttachmentItem[]
          }
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

function ProfitStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
