import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Clientes · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();
  let query = supabase
    .from("clients")
    .select("id, name, nif, email", { count: "exact" })
    .is("deleted_at", null);

  if (q.length > 0) {
    const p = `%${escapeIlike(q)}%`;
    query = query.or(`name.ilike.${p},nif.ilike.${p},email.ilike.${p}`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <ListPage
      title="Clientes"
      empty={q ? "Sin coincidencias para tu búsqueda." : "Aún no hay clientes."}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre, NIF o email…"
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      actions={
        <Button asChild size="sm">
          <Link href="/clients/new">Nuevo</Link>
        </Button>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/clients/new">Crear primer cliente</Link>
        </Button>
      }
      rows={
        data?.map((c) => ({
          id: c.id as string,
          href: `/clients/${c.id}`,
          cells: [
            c.name as string,
            (c.nif as string | null) ?? "—",
            (c.email as string | null) ?? "—",
          ],
        })) ?? []
      }
      headers={["Nombre", "NIF", "Email"]}
    />
  );
}
