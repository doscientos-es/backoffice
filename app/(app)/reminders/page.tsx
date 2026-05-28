import { ListPage } from "@/components/layout/list-page";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Avisos · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendientes" },
  { value: "completed", label: "Completados" },
];

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();
  let query = supabase
    .from("reminders")
    .select("id, title, remind_at, completed_at", { count: "exact" });

  if (q.length > 0) query = query.ilike("title", `%${escapeIlike(q)}%`);
  if (status === "pending") query = query.is("completed_at", null);
  else if (status === "completed") query = query.not("completed_at", "is", null);

  const { data, error, count } = await query
    .order("remind_at", { ascending: true })
    .range(from, to);

  return (
    <ListPage
      title="Avisos"
      empty={q || status ? "Sin coincidencias." : "Aún no hay avisos."}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por título…"
      filters={[{ key: "status", label: "Estado", options: STATUS_OPTIONS }]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
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
