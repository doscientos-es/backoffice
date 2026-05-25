import { ListPage } from "@/components/layout/list-page";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Documentos · doscientos" };

export default async function DocumentsPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, mime_type, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ListPage
      title="Documentos"
      empty="Aún no hay documentos."
      error={error?.message}
      headers={["Nombre", "Tipo", "Tamaño", "Subido"]}
      rows={
        data?.map((d) => ({
          id: d.id as string,
          href: `/documents/${d.id}`,
          cells: [
            d.name as string,
            (d.mime_type as string | null) ?? "—",
            d.size_bytes ? `${Math.ceil(Number(d.size_bytes) / 1024)} KB` : "—",
            formatDate(d.created_at as string),
          ],
        })) ?? []
      }
    />
  );
}
