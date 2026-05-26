import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTask } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En curso" },
  { value: "in_review", label: "Revisión" },
  { value: "done", label: "Terminada" },
  { value: "cancelled", label: "Cancelada" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const STATUS_VARIANT = {
  todo: "neutral",
  in_progress: "info",
  in_review: "warning",
  done: "success",
  cancelled: "danger",
} as const;

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: task } = await supabase
    .from("tasks")
    .select(
      "*, projects(id, name), leads(id, name), milestones(id, name), team_members:assignee_id(id, name), creator:created_by(id, name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!task) notFound();

  const project = (task as unknown as { projects: { id: string; name: string } | null }).projects;
  const lead = (task as unknown as { leads: { id: string; name: string } | null }).leads;
  const assignee = (task as unknown as { team_members: { id: string; name: string } | null })
    .team_members;
  const creator = (task as unknown as { creator: { id: string; name: string } | null }).creator;

  const [{ data: members }, { data: milestones }] = await Promise.all([
    supabase.from("team_members").select("id, name").is("deleted_at", null).order("name"),
    project?.id
      ? supabase
          .from("milestones")
          .select("id, name")
          .eq("project_id", project.id)
          .order("due_date", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const backHref = project ? `/projects/${project.id}/tasks` : "/tasks";
  const backLabel = project ? `Volver a ${project.name}` : "Volver a tareas";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={task.title as string}
        description={project?.name ?? lead?.name ?? undefined}
        back={<BackLink href={backHref} label={backLabel} />}
        actions={
          <Badge variant={STATUS_VARIANT[task.status as keyof typeof STATUS_VARIANT]}>
            {task.status as string}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Proyecto">
                {project ? (
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Lead">
                {lead ? (
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Hito">
                {(task as unknown as { milestones: { name: string } | null }).milestones?.name ??
                  "—"}
              </DetailRow>
              <DetailRow label="Asignada">{assignee?.name ?? "—"}</DetailRow>
              <DetailRow label="Creada por">{creator?.name ?? "—"}</DetailRow>
              <DetailRow label="Vence">{formatDate(task.due_date as string | null)}</DetailRow>
              <DetailRow label="Iniciada">{formatDate(task.started_at as string | null)}</DetailRow>
              <DetailRow label="Completada">
                {formatDate(task.completed_at as string | null)}
              </DetailRow>
              <DetailRow label="Estimadas">
                {task.estimated_hours ? `${task.estimated_hours} h` : "—"}
              </DetailRow>
              <DetailRow label="Facturable">{task.is_billable ? "Sí" : "No"}</DetailRow>
              {task.github_issue_url ? (
                <DetailRow label="GitHub">
                  <a
                    href={task.github_issue_url as string}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate hover:underline"
                  >
                    #{task.github_issue_number as number}
                  </a>
                </DetailRow>
              ) : null}
            </DetailGrid>
            {task.description ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Descripción
                </p>
                <p className="whitespace-pre-wrap text-sm">{task.description as string}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Editar</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateTask} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={id} />
              <FormRow label="Título" htmlFor="e_title">
                <Input id="e_title" name="title" defaultValue={task.title as string} required />
              </FormRow>
              <FormRow label="Descripción" htmlFor="e_desc">
                <Textarea
                  id="e_desc"
                  name="description"
                  rows={3}
                  defaultValue={(task.description as string | null) ?? ""}
                />
              </FormRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Estado" htmlFor="e_status">
                  <Select id="e_status" name="status" defaultValue={task.status as string}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="Prioridad" htmlFor="e_priority">
                  <Select id="e_priority" name="priority" defaultValue={task.priority as string}>
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="Asignada" htmlFor="e_assignee">
                  <Select
                    id="e_assignee"
                    name="assignee_id"
                    defaultValue={(assignee?.id as string | undefined) ?? ""}
                  >
                    <option value="">—</option>
                    {members?.map((m) => (
                      <option key={m.id as string} value={m.id as string}>
                        {m.name as string}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="Hito" htmlFor="e_milestone">
                  <Select
                    id="e_milestone"
                    name="milestone_id"
                    defaultValue={(task.milestone_id as string | null) ?? ""}
                  >
                    <option value="">—</option>
                    {milestones?.map((m) => (
                      <option key={m.id as string} value={m.id as string}>
                        {m.name as string}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="Vencimiento" htmlFor="e_due">
                  <Input
                    id="e_due"
                    name="due_date"
                    type="date"
                    defaultValue={(task.due_date as string | null) ?? ""}
                  />
                </FormRow>
                <FormRow label="Estimadas (h)" htmlFor="e_est">
                  <Input
                    id="e_est"
                    name="estimated_hours"
                    type="number"
                    step="0.25"
                    min="0"
                    defaultValue={(task.estimated_hours as number | null)?.toString() ?? ""}
                  />
                </FormRow>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_billable"
                  defaultChecked={task.is_billable as boolean}
                  className="size-4 rounded border-input"
                />
                Facturable
              </label>
              <div className="flex justify-end border-t border-border pt-3">
                <Button type="submit" size="sm">
                  Guardar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function F({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}
