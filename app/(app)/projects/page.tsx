import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Proyectos · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "planned", label: "Planificado" },
  { value: "active", label: "Activo" },
  { value: "on_hold", label: "En pausa" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();
  let query = supabase
    .from("projects")
    .select("id, name, status, client_id, clients(name)", { count: "exact" })
    .is("deleted_at", null);

  if (q.length > 0) query = query.ilike("name", `%${escapeIlike(q)}%`);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <ListPage
      title="Proyectos"
      empty={q || status ? "Sin coincidencias." : "Aún no hay proyectos."}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      filters={[{ key: "status", label: "Estado", options: STATUS_OPTIONS }]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      actions={
        <Button asChild size="sm">
          <Link href="/projects/new">Nuevo</Link>
        </Button>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/projects/new">Crear primer proyecto</Link>
        </Button>
      }
      headers={["Nombre", "Cliente", "Estado"]}
      rows={
        data?.map((p) => ({
          id: p.id as string,
          href: `/projects/${p.id}`,
          cells: [
            p.name as string,
            (p as unknown as { clients: { name: string } | null }).clients?.name ?? "—",
            p.status as string,
          ],
        })) ?? []
      }
    />
  );
}
