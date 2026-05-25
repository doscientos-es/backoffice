import { ListPage } from "@/components/layout/list-page";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Clientes · doscientos" };

export default async function ClientsPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, nif, email")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ListPage
      title="Clientes"
      empty="Aún no hay clientes."
      error={error?.message}
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
