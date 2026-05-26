import { ListPage } from "@/components/layout/list-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  type ExpenseCategory,
  type ExpenseStatus,
} from "@/lib/finance";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Gastos · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<ExpenseStatus, "info" | "success" | "neutral"> = {
  pending: "info",
  paid: "success",
  cancelled: "neutral",
};

type SearchParams = Promise<{ year?: string; category?: string }>;

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const { year, category } = await searchParams;
  const supabase = await createServerClient();

  // Available years (newest first); fall back to current year when empty.
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

  const selectedYear = years.includes(year ?? "") ? (year as string) : years[0];
  const selectedCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(category ?? "")
    ? (category as ExpenseCategory)
    : null;

  let query = supabase
    .from("expenses")
    .select("id, vendor, category, status, total, expense_date, recurrence")
    .is("deleted_at", null)
    .gte("expense_date", `${selectedYear}-01-01`)
    .lte("expense_date", `${selectedYear}-12-31`)
    .order("expense_date", { ascending: false })
    .limit(200);
  if (selectedCategory) query = query.eq("category", selectedCategory);

  const { data, error } = await query;

  const total = (data ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <ListPage
        title="Gastos"
        description={`Total ${selectedYear}: ${formatEUR(total)}`}
        actions={
          <div className="flex items-center gap-2">
            <form className="flex items-center gap-2">
              <Select
                name="year"
                defaultValue={selectedYear}
                aria-label="Año"
                className="h-8 text-xs"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <Select
                name="category"
                defaultValue={selectedCategory ?? ""}
                aria-label="Categoría"
                className="h-8 text-xs"
              >
                <option value="">Todas las categorías</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline" size="sm">
                Filtrar
              </Button>
            </form>
            <Button asChild size="sm">
              <Link href="/finance/expenses/new">Nuevo gasto</Link>
            </Button>
          </div>
        }
        empty="No hay gastos para este filtro."
        emptyAction={
          <Button asChild size="sm">
            <Link href="/finance/expenses/new">Registrar el primero</Link>
          </Button>
        }
        error={error?.message}
        headers={["Fecha", "Proveedor", "Categoría", "Estado", "Total"]}
        rows={
          data?.map((e) => ({
            id: e.id as string,
            href: `/finance/expenses/${e.id}`,
            cells: [
              formatDate(e.expense_date as string),
              e.vendor as string,
              EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? (e.category as string),
              <Badge
                key={`${e.id}-status`}
                variant={STATUS_VARIANT[e.status as ExpenseStatus] ?? "neutral"}
              >
                {EXPENSE_STATUS_LABELS[e.status as ExpenseStatus] ?? (e.status as string)}
              </Badge>,
              <span key={`${e.id}-total`} className="tabular-nums">
                {formatEUR(Number(e.total ?? 0))}
              </span>,
            ],
          })) ?? []
        }
      />
    </div>
  );
}
