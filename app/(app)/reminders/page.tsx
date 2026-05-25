import { ListPage } from "@/components/layout/list-page";
import { createServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Avisos · doscientos" };

export default async function RemindersPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, remind_at, completed_at")
    .order("remind_at", { ascending: true })
    .limit(50);

  return (
    <ListPage
      title="Avisos"
      empty="Aún no hay avisos."
      error={error?.message}
      headers={["Título", "Recordar el", "Completado"]}
      rows={
        data?.map((r) => ({
          id: r.id as string,
          href: `/reminders/${r.id}`,
          cells: [
            r.title as string,
            formatDateTime(r.remind_at as string),
            r.completed_at ? formatDateTime(r.completed_at as string) : "—",
          ],
        })) ?? []
      }
    />
  );
}
