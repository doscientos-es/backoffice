import { ListPage } from "@/components/layout/list-page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
} from "@/lib/finance";
import { getExpensesPage, parseExpenseListSearchParams } from "@/lib/finance/queries";
import { EXPENSE_LIST_PAGE_SIZE } from "@/lib/finance/types";
import { EXPENSE_STATUS } from "@/lib/status";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Gastos · doscientos" };
export const dynamic = "force-dynamic";

const CATEGORY_FILTER_OPTIONS = EXPENSE_CATEGORIES.map((c) => ({
  value: c,
  label: EXPENSE_CATEGORY_LABELS[c],
}));

const STATUS_FILTER_OPTIONS = EXPENSE_STATUSES.map((s) => ({
  value: s,
  label: EXPENSE_STATUS_LABELS[s],
}));

type SearchParams = Promise<{
  year?: string;
  category?: string;
  status?: string;
  q?: string;
  page?: string;
}>;

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { params } = parseExpenseListSearchParams(sp);
  const { expenses, count, total, years, error } = await getExpensesPage(params);
  const { category, status, q, page } = params;
  const year = params.year && years.includes(params.year) ? params.year : null;
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
      error={error ?? undefined}
      searchKey="q"
      searchPlaceholder="Buscar por proveedor…"
      filters={[
        { key: "year", label: "Año", options: years.map((y) => ({ value: y, label: y })) },
        { key: "category", label: "Categoría", options: CATEGORY_FILTER_OPTIONS },
        { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
      ]}
      pagination={{ page, pageSize: EXPENSE_LIST_PAGE_SIZE, total: count }}
      headers={["Fecha", "Proveedor", "Categoría", "Estado", "Total"]}
      align={["left", "left", "left", "left", "right"]}
      rows={expenses.map((e) => ({
        id: e.id,
        href: `/finance/expenses/${e.id}`,
        cells: [
          formatDate(e.expense_date),
          e.vendor,
          EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
          <StatusBadge key={`${e.id}-status`} meta={EXPENSE_STATUS} value={e.status} />,
          formatEUR(e.total),
        ],
      }))}
    />
  );
}
