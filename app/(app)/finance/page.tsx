import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
  buildMonthlySeries,
  profitMargin,
} from "@/lib/finance";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { FinanceChart } from "./finance-chart";

export const metadata = { title: "Finanzas · doscientos" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireUser();
  const supabase = await createServerClient();

  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartISO = monthStart.toISOString().slice(0, 10);
  const sixMonthsAgoISO = sixMonthsAgo.toISOString().slice(0, 10);

  const [
    { data: revenueRows },
    { data: expenseRows },
    { data: monthRevenue },
    { data: monthExpenses },
    { data: recentExpenses },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("issue_date, total")
      .gte("issue_date", sixMonthsAgoISO)
      .neq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("expense_date, total")
      .gte("expense_date", sixMonthsAgoISO)
      .neq("status", "cancelled")
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("total")
      .gte("issue_date", monthStartISO)
      .neq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("total, category")
      .gte("expense_date", monthStartISO)
      .neq("status", "cancelled")
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("id, vendor, category, total, expense_date, status")
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("id, full_number, total, issue_date, clients(name)")
      .neq("status", "draft")
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(5),
  ]);

  const series = buildMonthlySeries(
    (revenueRows ?? []).map((r) => ({ date: r.issue_date as string, total: Number(r.total ?? 0) })),
    (expenseRows ?? []).map((r) => ({
      date: r.expense_date as string,
      total: Number(r.total ?? 0),
    })),
    today,
  );

  const revenueMonth = (monthRevenue ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);
  const expenseMonth = (monthExpenses ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);
  const netMonth = revenueMonth - expenseMonth;
  const margin = profitMargin(revenueMonth, expenseMonth);

  const byCategory = new Map<ExpenseCategory, number>();
  for (const row of monthExpenses ?? []) {
    const k = row.category as ExpenseCategory;
    byCategory.set(k, (byCategory.get(k) ?? 0) + Number(row.total ?? 0));
  }
  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finanzas"
        description="Ingresos (facturas) vs gastos operativos."
        actions={
          <Button asChild size="sm">
            <Link href="/finance/expenses/new">Nuevo gasto</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ingresos este mes" value={formatEUR(revenueMonth)} tone="success" />
        <Stat label="Gastos este mes" value={formatEUR(expenseMonth)} tone="danger" />
        <Stat
          label="Beneficio neto"
          value={formatEUR(netMonth)}
          tone={netMonth >= 0 ? "success" : "danger"}
        />
        <Stat
          label="Margen"
          value={margin == null ? "—" : `${margin.toFixed(1)}%`}
          tone={margin != null && margin >= 0 ? "info" : "danger"}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ingresos vs gastos · últimos 6 meses</CardTitle>
            <Link
              href="/finance/expenses"
              className="text-xs text-muted-foreground hover:underline"
            >
              Ver todos los gastos →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <FinanceChart data={series} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top categorías · este mes</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {topCategories.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin gastos este mes.</p>
            ) : (
              <ul className="divide-y divide-border">
                {topCategories.map(([cat, total]) => (
                  <li key={cat} className="flex items-center justify-between px-6 py-2.5 text-sm">
                    <span>{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</span>
                    <span className="font-medium tabular-nums">{formatEUR(total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas facturas emitidas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!recentInvoices || recentInvoices.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin facturas recientes.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentInvoices.map((inv) => {
                  const client = (inv as unknown as { clients: { name: string } | null }).clients;
                  return (
                    <li
                      key={inv.id as string}
                      className="flex items-center justify-between px-6 py-2.5 text-sm"
                    >
                      <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                        {(inv.full_number as string) ?? "—"}
                        {client ? (
                          <span className="ml-2 text-muted-foreground">· {client.name}</span>
                        ) : null}
                      </Link>
                      <span className="tabular-nums">{formatEUR(Number(inv.total ?? 0))}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Últimos gastos</CardTitle>
            <Link
              href="/finance/expenses"
              className="text-xs text-muted-foreground hover:underline"
            >
              Ver todos →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {!recentExpenses || recentExpenses.length === 0 ? (
            <p className="px-6 py-2 text-sm text-muted-foreground">Sin gastos aún.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentExpenses.map((e) => (
                <li
                  key={e.id as string}
                  className="flex items-center justify-between px-6 py-2.5 text-sm"
                >
                  <Link href={`/finance/expenses/${e.id}`} className="font-medium hover:underline">
                    {e.vendor as string}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ??
                        (e.category as string)}{" "}
                      · {formatDate(e.expense_date as string)}
                    </span>
                  </Link>
                  <span className="tabular-nums">{formatEUR(Number(e.total ?? 0))}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: { label: string; value: number | string; tone?: "danger" | "info" | "success" }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "success"
        ? "text-emerald-700 dark:text-emerald-400"
        : tone === "info"
          ? "text-sky-700 dark:text-sky-400"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
