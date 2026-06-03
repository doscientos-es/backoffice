import {
  MetaAdsBalanceSkeleton,
  MetaAdsBalanceWidget,
} from "@/components/marketing/meta-ads-balance-card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { requireUser } from "@/lib/auth";
import { getGreeting, parseDashboardRange } from "@/lib/utils/date";
import type { Metadata } from "next";
import { AvisosWidget } from "./_components/avisos-widget";
import { KpiGrid } from "./_components/kpi-grid";
import { MyDayWidget } from "./_components/my-day-widget";
import { RangeSelector } from "./_components/range-selector";
import { RevenueWidget } from "./_components/revenue-widget";
import {
  AvisosWidgetSkeleton,
  KpiGridSkeleton,
  MyDayWidgetSkeleton,
  RangeSelectorSkeleton,
  RevenueWidgetSkeleton,
} from "./_components/widget-skeletons";

export const metadata: Metadata = { title: "Inicio · doscientos" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ range?: string | string[] }>;
};

export default async function InicioPage({ searchParams }: PageProps) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const range = parseDashboardRange(params.range);
  const greeting = getGreeting();
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aquí tienes lo que requiere tu atención.
          </p>
        </div>
        <SectionBoundary pending={<RangeSelectorSkeleton />} label="No se pudo cargar el selector">
          <RangeSelector current={range} />
        </SectionBoundary>
      </div>

      <SectionBoundary
        pending={<MyDayWidgetSkeleton />}
        label="No se pudo cargar tu día"
      >
        <MyDayWidget />
      </SectionBoundary>

      <SectionBoundary
        key={range}
        pending={<KpiGridSkeleton />}
        label="No se pudieron cargar los KPIs"
      >
        <KpiGrid range={range} />
      </SectionBoundary>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionBoundary
          pending={<MetaAdsBalanceSkeleton />}
          label="No se pudo cargar el saldo de Meta Ads"
        >
          <MetaAdsBalanceWidget />
        </SectionBoundary>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <SectionBoundary
          pending={<AvisosWidgetSkeleton />}
          label="No se pudieron cargar los avisos"
        >
          <AvisosWidget />
        </SectionBoundary>
        <SectionBoundary
          pending={<RevenueWidgetSkeleton />}
          label="No se pudieron cargar los ingresos"
        >
          <RevenueWidget />
        </SectionBoundary>
      </div>
    </div>
  );
}
