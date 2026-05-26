import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createTask } from "../actions";

export const metadata = { title: "Nueva tarea · doscientos" };
export const dynamic = "force-dynamic";

const STATUS = [
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En curso" },
  { value: "in_review", label: "Revisión" },
  { value: "done", label: "Terminada" },
];

const PRIORITY = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export default async function NewTaskPage({
  searchParams,
}: { searchParams: Promise<{ project_id?: string; lead_id?: string }> }) {
  await requireUser();
  const { project_id: presetProject, lead_id: presetLead } = await searchParams;
  const supabase = await createServerClient();

  const [{ data: projects }, { data: leads }, { data: members }, { data: milestones }] =
    await Promise.all([
      supabase.from("projects").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("leads").select("id, name").is("deleted_at", null).order("created_at", {
        ascending: false,
      }),
      supabase.from("team_members").select("id, name").is("deleted_at", null).order("name"),
      presetProject
        ? supabase
          .from("milestones")
          .select("id, name")
          .eq("project_id", presetProject)
          .order("due_date", { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva tarea"
        description="Crea trabajo asignable y rastreable."
        back={<BackLink href="/tasks" label="Volver a tareas" />}
      />

      <Card>
        <CardContent className="pt-6">
          <form action={createTask} className="flex flex-col gap-5">
            <FormRow label="Título" htmlFor="title" required>
              <Input id="title" name="title" required maxLength={200} autoFocus />
            </FormRow>

            <FormRow label="Descripción" htmlFor="description">
              <Textarea id="description" name="description" rows={3} maxLength={8000} />
            </FormRow>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormRow label="Proyecto" htmlFor="project_id">
                <Select id="project_id" name="project_id" defaultValue={presetProject ?? ""}>
                  <option value="">—</option>
                  {projects?.map((p) => (
                    <option key={p.id as string} value={p.id as string}>
                      {p.name as string}
                    </option>
                  ))}
                </Select>
              </FormRow>

              <FormRow label="Lead" htmlFor="lead_id">
                <Select id="lead_id" name="lead_id" defaultValue={presetLead ?? ""}>
                  <option value="">—</option>
                  {leads?.map((l) => (
                    <option key={l.id as string} value={l.id as string}>
                      {l.name as string}
                    </option>
                  ))}
                </Select>
              </FormRow>

              <FormRow label="Hito" htmlFor="milestone_id">
                <Select id="milestone_id" name="milestone_id" defaultValue="">
                  <option value="">—</option>
                  {milestones?.map((m) => (
                    <option key={m.id as string} value={m.id as string}>
                      {m.name as string}
                    </option>
                  ))}
                </Select>
              </FormRow>

              <FormRow label="Asignada a" htmlFor="assignee_id">
                <Select id="assignee_id" name="assignee_id" defaultValue="">
                  <option value="">—</option>
                  {members?.map((m) => (
                    <option key={m.id as string} value={m.id as string}>
                      {m.name as string}
                    </option>
                  ))}
                </Select>
              </FormRow>

              <FormRow label="Estado" htmlFor="status">
                <Select id="status" name="status" defaultValue="todo">
                  {STATUS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormRow>

              <FormRow label="Prioridad" htmlFor="priority">
                <Select id="priority" name="priority" defaultValue="medium">
                  {PRIORITY.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormRow>

              <FormRow label="Vencimiento" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </FormRow>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
              <Button type="submit" size="sm">
                Crear tarea
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
