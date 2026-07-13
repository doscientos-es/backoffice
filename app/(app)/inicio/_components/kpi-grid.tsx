import { StatCard } from "@/components/layout/stat-card";
import { getCompanyGoals, getDashboardKpis } from "@/lib/dashboard/queries";
import type { DashboardRange } from "@/lib/dashboard/types";
import { formatEUR } from "@/lib/utils";
import { computeTrend, describeRange, resolveDateRange } from "@/lib/utils/date";
import { FileSignature, Inbox, LineChart, Target } from "lucide-react";

export async function KpiGrid({ range }: { range: DashboardRange }) {
  const dateRange = resolveDateRange(range);
  const [kpis, goals] = await Promise.all([getDashboardKpis(dateRange), getCompanyGoals()]);
  const rangeLabel = describeRange(range);

  const conversionPct = Math.round(kpis.conversionRate * 1000) / 10;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Leads nuevos"
        value={kpis.leadsNew}
        tone="info"
        icon={Inbox}
        href="/leads"
        hint={rangeLabel}
        trend={goals.leads_new ? undefined : computeTrend(kpis.leadsNew, kpis.leadsNewPrev)}
        goal={goals.leads_new ? { current: kpis.leadsNew, target: goals.leads_new } : undefined}
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
        goal={
          goals.conversion_rate
            ? { current: kpis.conversionRate, target: goals.conversion_rate }
            : undefined
        }
        trend={computeTrend(kpis.conversionRate * 100, kpis.conversionRatePrev * 100)}
      />
    </div>
  );
}
