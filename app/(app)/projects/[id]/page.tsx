import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProject } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  planning: "neutral",
  active: "success",
  on_hold: "warning",
  done: "info",
  cancelled: "danger",
} as const;

const STATUS_OPTIONS = [
  { value: "planning", label: "Planificación" },
  { value: "active", label: "Activo" },
  { value: "on_hold", label: "En pausa" },
  { value: "done", label: "Terminado" },
  { value: "cancelled", label: "Cancelado" },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) notFound();

  const client = (project as unknown as { clients: { id: string; name: string } | null }).clients;

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.name as string}
        description={client?.name}
        back={<BackLink href="/projects" label="Volver a proyectos" />}
        actions={
          <Badge variant={STATUS_VARIANT[project.status as keyof typeof STATUS_VARIANT]}>
            {project.status as string}
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
          <CardHeader>
            <CardTitle>Editar</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateProject} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={id} />
              <FormRow label="Cliente" htmlFor="e_client" required>
                <Select id="e_client" name="client_id" defaultValue={client?.id ?? ""} required>
                  {clients?.map((c) => (
                    <option key={c.id as string} value={c.id as string}>
                      {c.name as string}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Nombre" htmlFor="e_name" required>
                <Input
                  id="e_name"
                  name="name"
                  defaultValue={project.name as string}
                  required
                  maxLength={160}
                  placeholder="Rediseño web 2026"
                />
              </FormRow>
              <FormRow label="Estado" htmlFor="e_status">
                <Select id="e_status" name="status" defaultValue={project.status as string}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Inicio" htmlFor="e_starts">
                  <Input
                    id="e_starts"
                    name="starts_at"
                    type="date"
                    defaultValue={(project.starts_at as string | null) ?? ""}
                  />
                </FormRow>
                <FormRow label="Fin previsto" htmlFor="e_ends">
                  <Input
                    id="e_ends"
                    name="ends_at"
                    type="date"
                    defaultValue={(project.ends_at as string | null) ?? ""}
                  />
                </FormRow>
              </div>
              <FormRow label="Repositorio GitHub" htmlFor="e_github" hint="URL completa del repositorio.">
                <Input
                  id="e_github"
                  name="github_repo"
                  type="url"
                  inputMode="url"
                  defaultValue={(project.github_repo as string | null) ?? ""}
                  placeholder="https://github.com/org/repo"
                />
              </FormRow>
              <FormRow label="Descripción" htmlFor="e_desc">
                <Textarea
                  id="e_desc"
                  name="description"
                  rows={3}
                  maxLength={4000}
                  defaultValue={(project.description as string | null) ?? ""}
                  placeholder="Objetivos, entregables, criterios de aceptación…"
                />
              </FormRow>
              <div className="flex justify-end border-t border-border pt-3">
                <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
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
                  <Link
                    href={`/tasks/${t.id as string}`}
                    className="font-medium hover:underline"
                  >
                    {t.title as string}
                  </Link>
                  <span className="text-xs text-muted-foreground">{t.status as string}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function F({
  label,
  id,
  required,
  hint,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
