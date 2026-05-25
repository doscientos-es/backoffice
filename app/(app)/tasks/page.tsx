import { ListPage } from "@/components/layout/list-page";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Tareas · doscientos" };

export default async function TasksPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, priority")
    .is("deleted_at", null)
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);

  return (
    <ListPage
      title="Tareas"
      empty="Aún no hay tareas."
      error={error?.message}
      headers={["Título", "Estado", "Vencimiento", "Prioridad"]}
      rows={
        data?.map((t) => ({
          id: t.id as string,
          href: `/tasks/${t.id}`,
          cells: [
            t.title as string,
            t.status as string,
            formatDate(t.due_date as string | null),
            String(t.priority ?? 0),
          ],
        })) ?? []
      }
    />
  );
}
