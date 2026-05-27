import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createTask } from "../actions";
import { TaskFormFields } from "../task-form-fields";

export const metadata = { title: "Nueva tarea · doscientos" };
export const dynamic = "force-dynamic";

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
            <TaskFormFields
              autoFocusTitle
              includeParentSelectors
              projects={(projects ?? []) as Array<{ id: string; name: string }>}
              leads={(leads ?? []) as Array<{ id: string; name: string }>}
              members={(members ?? []) as Array<{ id: string; name: string }>}
              milestones={(milestones ?? []) as Array<{ id: string; name: string }>}
              defaults={{ project_id: presetProject ?? "", lead_id: presetLead ?? "" }}
            />
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
