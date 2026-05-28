import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { PROPOSAL_STATUS, type ProposalStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Propuestas · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_FILTER_OPTIONS = (Object.keys(PROPOSAL_STATUS) as ProposalStatus[]).map((value) => ({
  value,
  label: PROPOSAL_STATUS[value].label,
}));

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export default async function ProposalsPage({
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
    .from("proposals")
    .select("id, number, title, status, total, valid_until", { count: "exact" })
    .is("deleted_at", null);

  if (q.length > 0) {
    const pattern = `%${escapeIlike(q)}%`;
    query = query.or(`number.ilike.${pattern},title.ilike.${pattern}`);
  }
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const newAction = (
    <Button asChild size="sm">
      <Link href="/proposals/new">
        <Plus className="h-4 w-4" />
        Nueva propuesta
      </Link>
    </Button>
  );

  return (
    <ListPage
      title="Propuestas"
      empty={q || status ? "Sin coincidencias." : "Aún no hay propuestas."}
      error={error?.message}
      actions={newAction}
      emptyAction={newAction}
      addHref="/proposals/new"
      addLabel="Nueva propuesta"
      searchKey="q"
      searchPlaceholder="Buscar por número o título…"
      filters={[{ key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS }]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      headers={["Número", "Título", "Estado", "Importe", "Válida hasta"]}
      align={["left", "left", "left", "right", "left"]}
      rows={
        data?.map((p) => ({
          id: p.id as string,
          href: `/proposals/${p.id}`,
          cells: [
            p.number as string,
            p.title as string,
            <StatusBadge key="status" meta={PROPOSAL_STATUS} value={p.status as string} />,
            formatEUR(p.total as number),
            formatDate(p.valid_until as string | null),
          ],
        })) ?? []
      }
    />
  );
}
