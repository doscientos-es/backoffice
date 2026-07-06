import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { PROPOSAL_STATUS, type ProposalStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { escapeIlike, parsePage, parseSortParam, parseStringParam } from "@/lib/utils/search-params";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Propuestas · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const PROPOSAL_SORT_COLUMNS = ["number", "title", "status", "total", "valid_until"] as const;

const STATUS_FILTER_OPTIONS = (Object.keys(PROPOSAL_STATUS) as ProposalStatus[]).map((value) => ({
  value,
  label: PROPOSAL_STATUS[value].label,
}));

const EXPIRY_FILTER_OPTIONS = [
  { value: "expiring_7", label: "Próximos 7 días" },
  { value: "expiring_30", label: "Próximos 30 días" },
  { value: "expired", label: "Vencidas" },
];

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const q = parseStringParam(sp, "q");
  const status = parseStringParam(sp, "status");
  const clientId = parseStringParam(sp, "client");
  const expiry = parseStringParam(sp, "expiry");
  const page = parsePage(sp);
  const { sort, dir } = parseSortParam(sp, PROPOSAL_SORT_COLUMNS, "created_at", "desc");
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  const CLIENT_FILTER_OPTIONS = (clients ?? []).map((c) => ({ value: c.id, label: c.name }));

  let query = supabase
    .from("proposals")
    .select(
      "id, number, title, status, total, valid_until, client_id, clients(name), lead_id, leads(name), project_id, projects(name)",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (q.length > 0) {
    const pattern = `%${escapeIlike(q)}%`;
    query = query.or(`number.ilike.${pattern},title.ilike.${pattern}`);
  }
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  if (expiry === "expired") {
    query = query.lt("valid_until", new Date().toISOString().slice(0, 10));
  } else if (expiry === "expiring_7") {
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
    query = query.gte("valid_until", today).lte("valid_until", in7);
  } else if (expiry === "expiring_30") {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    query = query.gte("valid_until", today).lte("valid_until", in30);
  }

  const ascending = sort !== "created_at" ? dir !== "desc" : false;
  const { data, error, count } = await query
    .order(sort, { ascending, nullsFirst: false })
    .range(from, to);

  const newAction = (
    <Button asChild size="sm">
      <Link href="/proposals/new">
        <Plus className="h-4 w-4" />
        Nueva propuesta
      </Link>
    </Button>
  );

  const hasFilters = !!(q || status || clientId || expiry);

  return (
    <ListPage
      title="Propuestas"
      empty={hasFilters ? "Sin coincidencias." : "Aún no hay propuestas."}
      error={error?.message}
      actions={newAction}
      emptyAction={newAction}
      addHref="/proposals/new"
      addLabel="Nueva propuesta"
      searchKey="q"
      searchPlaceholder="Buscar por número o título…"
      filters={[
        { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
        { key: "client", label: "Cliente", options: CLIENT_FILTER_OPTIONS },
        { key: "expiry", label: "Vencimiento", options: EXPIRY_FILTER_OPTIONS },
      ]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      headers={[
        { label: "Número", sortKey: "number" },
        { label: "Título", sortKey: "title" },
        { label: "Cliente / Lead" },
        { label: "Proyecto" },
        { label: "Estado", sortKey: "status" },
        { label: "Importe", align: "right", sortKey: "total" },
        { label: "Válida hasta", sortKey: "valid_until" },
      ]}
      align={["left", "left", "left", "left", "left", "right", "left"]}
      exportFilename="propuestas"
      rows={
        data?.map((p) => {
          const clientName =
            (p.clients as { name: string }[] | null)?.[0]?.name ??
            (p.leads as { name: string }[] | null)?.[0]?.name ??
            "—";
          const projectName = (p.projects as { name: string }[] | null)?.[0]?.name ?? "—";
          return {
            id: p.id as string,
            href: `/proposals/${p.id}`,
            cells: [
              (p.number as string | null) ?? "Borrador",
              p.title as string,
              clientName,
              projectName,
              <StatusBadge key="status" meta={PROPOSAL_STATUS} value={p.status as string} />,
              formatEUR(p.total as number),
              formatDate(p.valid_until as string | null),
            ],
            csvValues: [
              (p.number as string | null) ?? "Borrador",
              p.title as string,
              clientName,
              projectName,
              p.status as string,
              p.total as number,
              (p.valid_until as string | null) ?? "",
            ],
          };
        }) ?? []
      }
    />
  );
}
