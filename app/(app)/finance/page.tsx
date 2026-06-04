import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { FinanceDetails } from "./_components/finance-details";
import { FinanceKpis } from "./_components/finance-kpis";
import { FinanceOverviewChart } from "./_components/finance-overview-chart";
import { ChartSkeleton, DetailsSkeleton, KpisSkeleton } from "./_components/finance-skeletons";

export const metadata: Metadata = { title: "Finanzas · doscientos" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finanzas"
        description="Ingresos (facturas) vs gastos operativos."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/finance/expenses">Ver gastos</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/finance/expenses/new">Nuevo gasto</Link>
            </Button>
          </div>
        }
      />

      <SectionBoundary pending={<KpisSkeleton />} label="No se pudieron cargar los KPIs">
        <FinanceKpis />
      </SectionBoundary>

      <SectionBoundary pending={<ChartSkeleton />} label="No se pudo cargar el gráfico">
        <FinanceOverviewChart />
      </SectionBoundary>

      <SectionBoundary pending={<DetailsSkeleton />} label="No se pudieron cargar los detalles">
        <FinanceDetails />
      </SectionBoundary>
    </div>
  );
}
