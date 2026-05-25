import { ListPage } from "@/components/layout/list-page";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";

export const metadata = { title: "Propuestas · doscientos" };

export default async function ProposalsPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("id, number, title, status, total, valid_until")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ListPage
      title="Propuestas"
      empty="Aún no hay propuestas."
      error={error?.message}
      headers={["Número", "Título", "Estado", "Importe", "Válida hasta"]}
      rows={
        data?.map((p) => ({
          id: p.id as string,
          href: `/proposals/${p.id}`,
          cells: [
            p.number as string,
            p.title as string,
            p.status as string,
            formatEUR(p.total as number),
            formatDate(p.valid_until as string | null),
          ],
        })) ?? []
      }
    />
  );
}
