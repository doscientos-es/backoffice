import { StatCard } from "@/components/layout/stat-card";
import { getDashboardKpis } from "@/lib/dashboard/queries";
import type { DashboardRange } from "@/lib/dashboard/types";
import { formatEUR } from "@/lib/utils";
import { computeTrend, describeRange, resolveDateRange } from "@/lib/utils/date";
import { AlertTriangle, FileSignature, Inbox, LineChart, Target, Wallet } from "lucide-react";

export async function KpiGrid({ range }: { range: DashboardRange }) {
  const dateRange = resolveDateRange(range);
  const kpis = await getDashboardKpis(dateRange);
  const rangeLabel = describeRange(range);

  const conversionPct = Math.round(kpis.conversionRate * 1000) / 10;

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      <StatCard
        label="Leads nuevos"
        value={kpis.leadsNew}
        tone="info"
        icon={Inbox}
        href="/leads"
        hint={rangeLabel}
        trend={computeTrend(kpis.leadsNew, kpis.leadsNewPrev)}
      />
      <StatCard
        label="Propuestas abiertas"
        value={kpis.proposalsOpen}
        tone="info"
        icon={FileSignature}
        href="/proposals"
        hint={rangeLabel}
        trend={computeTrend(kpis.proposalsOpen, kpis.proposalsOpenPrev)}
      />
      <StatCard
        label="Pipeline activo"
        value={formatEUR(kpis.pipelineValue)}
        tone="default"
        icon={LineChart}
        href="/proposals"
        hint="propuestas sin cerrar"
      />
      <StatCard
        label="Conversión"
        value={`${conversionPct.toFixed(1)}%`}
        tone="success"
        icon={Target}
        href="/leads"
        hint={`leads ganados · ${rangeLabel}`}
        trend={computeTrend(kpis.conversionRate * 100, kpis.conversionRatePrev * 100)}
      />
      <StatCard
        label="Facturas vencidas"
        value={kpis.overdueCount}
        tone={kpis.overdueCount > 0 ? "danger" : "default"}
        icon={AlertTriangle}
        href="/invoices?status=overdue"
        hint={kpis.overdueCount > 0 ? "requieren cobro" : "todo al día"}
      />
      <StatCard
        label="Ingresos este mes"
        value={formatEUR(kpis.monthRevenue)}
        tone="success"
        icon={Wallet}
        href="/finance"
        hint="vs. mes anterior"
        trend={computeTrend(kpis.monthRevenue, kpis.monthRevenuePrev)}
      />
    </div>
  );
}
