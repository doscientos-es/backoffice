import { PageHeader } from "@/components/layout/page-header";
import {
  MetaAdsBalanceSkeleton,
  MetaAdsBalanceWidget,
} from "@/components/marketing/meta-ads-balance-card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import {
  parseMarketingRange,
  parseMarketingSort,
  parseMarketingView,
  parseShowPaused,
  rangeToDates,
} from "@/lib/marketing/range";
import type { Metadata } from "next";
import { MarketingInsights } from "./_components/marketing-insights";
import { MarketingKpis } from "./_components/marketing-kpis";
import { InsightsSkeleton, KpiSkeleton, TableSkeleton } from "./_components/marketing-skeletons";
import { MarketingTable } from "./_components/marketing-table";
import { OptionsToolbar } from "./options-toolbar";
import { MarketingRangeSelector } from "./range-selector";
import { SyncMarketingButton } from "./sync-button";
import { MarketingViewTabs } from "./view-tabs";

export const metadata: Metadata = { title: "Marketing · doscientos" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  range?: string;
  sort?: string;
  paused?: string;
  view?: string;
}>;

export default async function MarketingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const range = parseMarketingRange(sp.range);
  const sort = parseMarketingSort(sp.sort);
  const showPaused = parseShowPaused(sp.paused);
  const view = parseMarketingView(sp.view);
  const { since, until, label: rangeLabel } = rangeToDates(range);

  const accountId = serverEnv().META_AD_ACCOUNT_ID || null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketing y Ads"
        description={`Métricas de anuncios en Meta Ads · ${rangeLabel}.`}
        actions={<SyncMarketingButton />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MarketingViewTabs current={view} />
          <MarketingRangeSelector current={range} />
        </div>
        <OptionsToolbar sort={sort} showPaused={showPaused} hidePaused={view === "campaigns"} />
      </div>

      <SectionBoundary
        key={`kpis-${view}-${since}-${until}-${sort}-${showPaused}`}
        pending={<KpiSkeleton />}
        label="No se pudieron cargar los KPIs"
      >
        <MarketingKpis
          view={view}
          since={since}
          until={until}
          sort={sort}
          showPaused={showPaused}
          rangeLabel={rangeLabel}
        />
      </SectionBoundary>

      <SectionBoundary
        key={`insights-${since}-${until}`}
        pending={<InsightsSkeleton />}
        label="No se pudo cargar el gráfico"
      >
        <MarketingInsights since={since} until={until} view={view} />
      </SectionBoundary>

      <SectionBoundary
        key={`table-${view}-${since}-${until}-${sort}-${showPaused}`}
        pending={<TableSkeleton />}
        label="No se pudo cargar la tabla"
      >
        <MarketingTable
          view={view}
          since={since}
          until={until}
          sort={sort}
          showPaused={showPaused}
          accountId={accountId}
        />
      </SectionBoundary>
      <div className="grid gap-3 lg:grid-cols-3">
        <SectionBoundary
          pending={<MetaAdsBalanceSkeleton />}
          label="No se pudo cargar el saldo de Meta Ads"
        >
          <MetaAdsBalanceWidget />
        </SectionBoundary>
      </div>
    </div>
  );
}
