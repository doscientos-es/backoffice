import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Proyectos · doscientos" };

export default async function ProjectsPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, client_id, clients(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ListPage
      title="Proyectos"
      empty="Aún no hay proyectos."
      error={error?.message}
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
