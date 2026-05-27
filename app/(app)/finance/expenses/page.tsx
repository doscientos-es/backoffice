import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
  type ExpenseCategory,
  type ExpenseStatus,
} from "@/lib/finance";
import { EXPENSE_STATUS } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Gastos · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const CATEGORY_FILTER_OPTIONS = EXPENSE_CATEGORIES.map((c) => ({
  value: c,
  label: EXPENSE_CATEGORY_LABELS[c],
}));

const STATUS_FILTER_OPTIONS = EXPENSE_STATUSES.map((s) => ({
  value: s,
  label: EXPENSE_STATUS_LABELS[s],
}));

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

type SearchParams = Promise<{
  year?: string;
  category?: string;
  status?: string;
  q?: string;
  page?: string;
}>;

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const supabase = await createServerClient();

  // Available years (newest first) for the year filter; fall back to current year when empty.
  const { data: yearRows } = await supabase
    .from("expenses")
    .select("expense_date")
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .limit(500);

  const years = Array.from(
    new Set(
      (yearRows ?? [])
        .map((r) => (r.expense_date as string | null)?.slice(0, 4))
        .filter((y): y is string => Boolean(y)),
    ),
  );
  if (years.length === 0) years.push(String(new Date().getFullYear()));

  const year = years.includes(sp.year ?? "") ? (sp.year as string) : null;
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(sp.category ?? "")
    ? (sp.category as ExpenseCategory)
    : null;
  const status = (EXPENSE_STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as ExpenseStatus)
    : null;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Page query (paginated rows with total count) and aggregate query (sum) must
  // apply the same filter set so the displayed total matches the visible rows.
  let pageQuery = supabase
    .from("expenses")
    .select("id, vendor, category, status, total, expense_date, recurrence", { count: "exact" })
    .is("deleted_at", null);
  let totalsQuery = supabase.from("expenses").select("total").is("deleted_at", null);

  if (year) {
    pageQuery = pageQuery.gte("expense_date", `${year}-01-01`).lte("expense_date", `${year}-12-31`);
    totalsQuery = totalsQuery
      .gte("expense_date", `${year}-01-01`)
      .lte("expense_date", `${year}-12-31`);
  }
  if (category) {
    pageQuery = pageQuery.eq("category", category);
    totalsQuery = totalsQuery.eq("category", category);
  }
  if (status) {
    pageQuery = pageQuery.eq("status", status);
    totalsQuery = totalsQuery.eq("status", status);
  }
  if (q.length > 0) {
    const pattern = `%${escapeIlike(q)}%`;
    pageQuery = pageQuery.ilike("vendor", pattern);
    totalsQuery = totalsQuery.ilike("vendor", pattern);
  }

  const [{ data, error, count }, { data: totalsRows }] = await Promise.all([
    pageQuery.order("expense_date", { ascending: false }).range(from, to),
    totalsQuery,
  ]);

  const total = (totalsRows ?? []).reduce((a, r) => a + Number((r as { total: number }).total ?? 0), 0);
  const totalLabel = year ? `Total ${year}` : "Total filtrado";

  return (
    <ListPage
      title="Gastos"
      description={`${totalLabel}: ${formatEUR(total)}`}
      actions={
        <Button asChild size="sm">
          <Link href="/finance/expenses/new">Nuevo gasto</Link>
        </Button>
      }
      empty={year || category || status || q ? "Sin coincidencias." : "Aún no hay gastos."}
      emptyAction={
        <Button asChild size="sm">
          <Link href="/finance/expenses/new">Registrar el primero</Link>
        </Button>
      }
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por proveedor…"
      filters={[
        { key: "year", label: "Año", options: years.map((y) => ({ value: y, label: y })) },
        { key: "category", label: "Categoría", options: CATEGORY_FILTER_OPTIONS },
        { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
      ]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      headers={["Fecha", "Proveedor", "Categoría", "Estado", "Total"]}
      align={["left", "left", "left", "left", "right"]}
      rows={
        data?.map((e) => ({
          id: e.id as string,
          href: `/finance/expenses/${e.id}`,
          cells: [
            formatDate(e.expense_date as string),
            e.vendor as string,
            EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? (e.category as string),
            <StatusBadge
              key={`${e.id}-status`}
              meta={EXPENSE_STATUS}
              value={e.status as ExpenseStatus}
            />,
            formatEUR(Number(e.total ?? 0)),
          ],
        })) ?? []
      }
    />
  );
}
