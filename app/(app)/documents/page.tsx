import { ListPage } from "@/components/layout/list-page";
import { Badge } from "@/components/ui/badge";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Documentos · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const KIND_LABEL: Record<string, string> = {
  file: "Archivo",
  technical_spec: "Espec. técnica",
};

const KIND_FILTER_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }));

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const kind = (sp.kind ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();
  let query = supabase
    .from("documents")
    .select("id, name, kind, mime_type, size_bytes, created_at", { count: "exact" });

  if (q.length > 0) query = query.ilike("name", `%${escapeIlike(q)}%`);
  if (kind) query = query.eq("kind", kind);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <ListPage
      title="Documentos"
      empty={q || kind ? "Sin coincidencias." : "Aún no hay documentos."}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      filters={[{ key: "kind", label: "Tipo", options: KIND_FILTER_OPTIONS }]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      headers={["Nombre", "Tipo", "Formato", "Tamaño", "Subido"]}
      rows={
        data?.map((d) => ({
          id: d.id as string,
          href: `/documents/${d.id}`,
          cells: [
            d.name as string,
            <Badge key="kind" variant="neutral">
              {KIND_LABEL[(d.kind as string) ?? "file"] ?? "—"}
            </Badge>,
            (d.mime_type as string | null) ?? null,
            d.size_bytes ? `${Math.ceil(Number(d.size_bytes) / 1024)} KB` : null,
            formatDate(d.created_at as string),
          ],
        })) ?? []
      }
    />
  );
}
