import { Suitcase as BriefcaseBusiness, CheckSquareIcon as CheckSquare, Clock as Clock3, GithubLogo as Github, Envelope as Mail, PhoneIcon as Phone, UsersIcon as Users } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { type MemberRole, requireUser } from "@/lib/auth";
import { LEAD_STATUS, PROJECT_STATUS, TASK_STATUS } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, memberAvatarUrl, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Detalle del miembro · doscientos" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
  viewer: "Solo lectura",
};

const ROLE_VARIANT: Record<MemberRole, "default" | "info" | "neutral"> = {
  owner: "default",
  admin: "info",
  member: "neutral",
  viewer: "neutral",
};

type Member = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  created_at: string;
  deleted_at: string | null;
  avatar_url: string | null;
  github_handle: string | null;
  job_title: string | null;
  phone: string | null;
  contact_email: string | null;
  email_alias: string | null;
  leads_assignable: boolean;
};

type ProjectRef = {
  id: string;
  name: string;
  status: string | null;
  client_name: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  project_id: string | null;
  projects: { id: string; name: string; status: string | null } | null;
};

type WorkLogRow = {
  id: string;
  work_date: string;
  hours: number | string;
  note: string | null;
  project_id: string;
  projects: { id: string; name: string; status: string | null } | null;
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function hoursLabel(hours: number): string {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(hours)} h`;
}

function mapProject(row: {
  id: unknown;
  name: unknown;
  status: unknown;
  clients: { name: string } | null;
}): ProjectRef {
  return {
    id: row.id as string,
    name: row.name as string,
    status: (row.status as string | null) ?? null,
    client_name: row.clients?.name ?? null,
  };
}

function EmptySection({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createServerClient();

  const [
    { data: memberData },
    { data: leadsData },
    { count: leadCount },
    { data: directTasksData },
    { data: taskMembersData },
    { data: workLogsData },
    { data: proposalMembersData },
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select(
        "id, name, email, role, created_at, deleted_at, avatar_url, github_handle, job_title, phone, contact_email, email_alias, leads_assignable",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id, name, company, status, estimated_value, updated_at, created_at")
      .eq("assigned_to", id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", id)
      .is("deleted_at", null),
    supabase
      .from("tasks")
      .select("id, title, status, due_date, project_id, projects(id, name, status)")
      .eq("assignee_id", id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase.from("task_members").select("task_id").eq("member_id", id),
    supabase
      .from("work_logs")
      .select("id, work_date, hours, note, project_id, projects(id, name, status)")
      .eq("member_id", id)
      .is("deleted_at", null)
      .order("work_date", { ascending: false }),
    supabase.from("proposal_team_members").select("proposal_id").eq("member_id", id),
  ]);

  if (!memberData) notFound();

  const member = memberData as unknown as Member;
  const directTasks = (directTasksData ?? []) as unknown as TaskRow[];
  const directTaskIds = new Set(directTasks.map((task) => task.id));
  const collaboratorTaskIds = (taskMembersData ?? [])
    .map((row) => row.task_id as string)
    .filter((taskId) => !directTaskIds.has(taskId));

  const { data: collaboratorTasksData } = collaboratorTaskIds.length
    ? await supabase
        .from("tasks")
        .select("id, title, status, due_date, project_id, projects(id, name, status)")
        .in("id", collaboratorTaskIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const tasks = [...directTasks, ...((collaboratorTasksData ?? []) as unknown as TaskRow[])];
  const workLogs = (workLogsData ?? []) as unknown as WorkLogRow[];
  const proposalIds = (proposalMembersData ?? []).map((row) => row.proposal_id as string);

  const { data: proposalRowsData } = proposalIds.length
    ? await supabase
        .from("proposals")
        .select("project_id")
        .in("id", proposalIds)
        .is("deleted_at", null)
    : { data: [] };

  const projectIds = [
    ...new Set(
      [
        ...tasks.map((task) => task.project_id),
        ...workLogs.map((log) => log.project_id),
        ...(proposalRowsData ?? []).map((row) => row.project_id as string | null),
      ].filter((projectId): projectId is string => Boolean(projectId)),
    ),
  ];

  const { data: projectData } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, name, status, clients(name)")
        .in("id", projectIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const projects = (projectData ?? []).map((row) =>
    mapProject(row as unknown as Parameters<typeof mapProject>[0]),
  );
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const totalHours = workLogs.reduce((total, log) => {
    const hours = typeof log.hours === "string" ? Number.parseFloat(log.hours) : log.hours;
    return total + (Number.isFinite(hours) ? hours : 0);
  }, 0);
  const avatarUrl = memberAvatarUrl({
    avatarUrl: member.avatar_url,
    githubHandle: member.github_handle,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={member.name}
        description={member.job_title ?? member.email}
        back={<BackLink href="/settings/team" label="Volver al equipo" />}
        icon={
          <Avatar size="lg">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={member.name} referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback>{initials(member.name)}</AvatarFallback>
          </Avatar>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leads asignados"
          value={leadCount ?? leadsData?.length ?? 0}
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Proyectos"
          value={projects.length}
          icon={BriefcaseBusiness}
          tone="success"
        />
        <StatCard label="Tareas" value={tasks.length} icon={CheckSquare} tone="warning" />
        <StatCard label="Horas registradas" value={hoursLabel(totalHours)} icon={Clock3} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Información y acceso de este miembro.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Rol">
                <Badge variant={ROLE_VARIANT[member.role]}>{ROLE_LABELS[member.role]}</Badge>
              </DetailRow>
              <DetailRow label="Incorporación">
                <span title={member.created_at}>{formatDate(member.created_at)}</span>
              </DetailRow>
              <DetailRow label="Antigüedad">{relativeTime(member.created_at)}</DetailRow>
              <DetailRow label="Estado">
                {member.deleted_at ? (
                  <Badge variant="danger">Desactivado</Badge>
                ) : (
                  <Badge variant="success">Activo</Badge>
                )}
              </DetailRow>
              <DetailRow label="Leads automáticos">
                {member.leads_assignable ? "Sí" : "No"}
              </DetailRow>
              <DetailRow label="Email">
                <a
                  className="inline-flex items-center gap-1 hover:text-primary"
                  href={`mailto:${member.email}`}
                >
                  <Mail className="size-3.5" />
                  {member.email}
                </a>
              </DetailRow>
              {member.phone ? (
                <DetailRow label="Teléfono">
                  <a
                    className="inline-flex items-center gap-1 hover:text-primary"
                    href={`tel:${member.phone}`}
                  >
                    <Phone className="size-3.5" />
                    {member.phone}
                  </a>
                </DetailRow>
              ) : null}
              {member.github_handle ? (
                <DetailRow label="GitHub">
                  <a
                    className="inline-flex items-center gap-1 hover:text-primary"
                    href={`https://github.com/${member.github_handle}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github className="size-3.5" />
                    {member.github_handle}
                  </a>
                </DetailRow>
              ) : null}
            </DetailGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proyectos</CardTitle>
            <CardDescription>
              Proyectos relacionados con sus tareas, horas y propuestas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptySection
                title="Sin proyectos todavía"
                description="Aún no hay actividad de este miembro en proyectos."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="rounded-lg border border-border/70 p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium">{project.name}</span>
                      <StatusBadge meta={PROJECT_STATUS} value={project.status} />
                    </div>
                    {project.client_name ? (
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {project.client_name}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads asignados</CardTitle>
            <CardDescription>
              {leadCount ?? leadsData?.length ?? 0} {leadCount === 1 ? "lead" : "leads"} en total.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {(leadsData ?? []).length === 0 ? (
              <EmptySection
                title="Sin leads asignados"
                description="Este miembro todavía no tiene leads a su cargo."
              />
            ) : (
              <div className="divide-y divide-border">
                {(leadsData ?? []).map((lead) => (
                  <Link
                    key={lead.id as string}
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{lead.name as string}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(lead.company as string | null) ?? "Sin empresa"}
                      </p>
                    </div>
                    <StatusBadge meta={LEAD_STATUS} value={lead.status as string} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tareas</CardTitle>
            <CardDescription>Asignadas directamente o como colaborador.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {tasks.length === 0 ? (
              <EmptySection
                title="Sin tareas"
                description="Este miembro todavía no tiene tareas asignadas."
              />
            ) : (
              <div className="divide-y divide-border">
                {tasks.slice(0, 12).map((task) => {
                  const project = task.project_id
                    ? projectById.get(task.project_id)
                    : task.projects;
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{task.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {project?.name ?? "Sin proyecto"}
                          {task.due_date ? ` · ${formatDate(task.due_date)}` : ""}
                        </p>
                      </div>
                      <StatusBadge meta={TASK_STATUS} value={task.status} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas horas registradas</CardTitle>
          <CardDescription>{hoursLabel(totalHours)} acumuladas en partes de horas.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {workLogs.length === 0 ? (
            <EmptySection
              title="Sin horas registradas"
              description="Todavía no hay partes de horas de este miembro."
            />
          ) : (
            <div className="divide-y divide-border">
              {workLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {projectById.get(log.project_id)?.name ?? log.projects?.name ?? "Proyecto"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(log.work_date)}
                      {log.note ? ` · ${log.note}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {hoursLabel(Number(log.hours) || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
