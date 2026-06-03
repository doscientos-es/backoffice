import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { requireUser } from "@/lib/auth";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/finance";
import { getFinanceOverview } from "@/lib/finance/queries";
import { formatDate, formatEUR } from "@/lib/utils";
import { Percent, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FinanceChart } from "./finance-chart";

export const metadata: Metadata = { title: "Finanzas · doscientos" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireUser();
  const {
    series,
    revenueMonth,
    expenseMonth,
    netMonth,
    margin,
    topCategories,
    recentExpenses,
    recentInvoices,
    memberContributions,
  } = await getFinanceOverview();

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
        <StatCard
          label="Ingresos este mes"
          value={formatEUR(revenueMonth)}
          tone="success"
          icon={TrendingUp}
        />
        <StatCard
          label="Gastos este mes"
          value={formatEUR(expenseMonth)}
          tone="danger"
          icon={TrendingDown}
        />
        <StatCard
          label="Beneficio neto"
          value={formatEUR(netMonth)}
          tone={netMonth >= 0 ? "success" : "danger"}
          icon={Receipt}
        />
        <StatCard
          label="Margen"
          value={margin == null ? "—" : `${margin.toFixed(1)}%`}
          tone={margin != null && margin >= 0 ? "info" : "danger"}
          icon={Percent}
        />
      </div>

      <SectionBoundary label="No se pudo cargar el gráfico">
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
      </SectionBoundary>

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
                {recentInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between px-6 py-2.5 text-sm"
                  >
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                      {inv.full_number ?? "—"}
                      {inv.client_name ? (
                        <span className="ml-2 text-muted-foreground">· {inv.client_name}</span>
                      ) : null}
                    </Link>
                    <span className="tabular-nums">{formatEUR(inv.total)}</span>
                  </li>
                ))}
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
                <li key={e.id} className="flex items-center justify-between px-6 py-2.5 text-sm">
                  <Link href={`/finance/expenses/${e.id}`} className="font-medium hover:underline">
                    {e.vendor}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category} ·{" "}
                      {formatDate(e.expense_date)}
                    </span>
                  </Link>
                  <span className="tabular-nums">{formatEUR(e.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {memberContributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aportaciones de socios</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {memberContributions
                .sort((a, b) => b.total - a.total)
                .map((c) => (
                  <li
                    key={c.memberId}
                    className="flex items-center justify-between px-6 py-2.5 text-sm"
                  >
                    <span className="font-medium">{c.memberName}</span>
                    <span className="tabular-nums">{formatEUR(c.total)}</span>
                  </li>
                ))}
            </ul>
            {memberContributions.length === 2 && (
              <div className="border-t border-border px-6 py-2 text-xs text-muted-foreground">
                Diferencia:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatEUR(
                    Math.abs(
                      (memberContributions[0]?.total ?? 0) - (memberContributions[1]?.total ?? 0),
                    ),
                  )}
                </span>{" "}
                a favor de{" "}
                {(memberContributions[0]?.total ?? 0) >= (memberContributions[1]?.total ?? 0)
                  ? memberContributions[0]?.memberName
                  : memberContributions[1]?.memberName}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
