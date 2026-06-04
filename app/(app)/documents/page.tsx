import { ListPage } from "@/components/layout/list-page";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documentos · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();
  let query = supabase
    .from("attachments")
    .select("id, name, mime_type, size_bytes, created_at", { count: "exact" })
    .is("deleted_at", null);

  if (q.length > 0) query = query.ilike("name", `%${escapeIlike(q)}%`);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <ListPage
      title="Documentos"
      empty={q ? "Sin coincidencias." : "Aún no hay documentos."}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      filters={[]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      headers={["Nombre", "Formato", "Tamaño", "Subido"]}
      rows={
        data?.map((d) => ({
          id: d.id as string,
          href: `/documents/${d.id}`,
          cells: [
            d.name as string,
            (d.mime_type as string | null) ?? null,
            d.size_bytes ? `${Math.ceil(Number(d.size_bytes) / 1024)} KB` : null,
            formatDate(d.created_at as string),
          ],
        })) ?? []
      }
    />
  );
}
