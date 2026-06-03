import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import {
  getActiveAdsOverview,
  getCampaignsOverview,
  getInsightsTimeSeries,
} from "@/lib/marketing/queries";
import {
  parseMarketingRange,
  parseMarketingSort,
  parseMarketingView,
  parseShowPaused,
  rangeToDates,
} from "@/lib/marketing/range";
import type { ActiveAdRow, CampaignRow } from "@/lib/marketing/types";
import { cn, formatEUR, relativeTime } from "@/lib/utils";
import { ExternalLink, MousePointerClick, TrendingUp, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { AdPreviewDialog } from "./ad-preview-dialog";
import { InsightsChart } from "./insights-chart";
import { OptionsToolbar } from "./options-toolbar";
import { MarketingRangeSelector } from "./range-selector";
import { SyncMarketingButton } from "./sync-button";
import { MarketingViewTabs } from "./view-tabs";

export const metadata: Metadata = { title: "Marketing · doscientos" };
export const dynamic = "force-dynamic";

const numberFmt = new Intl.NumberFormat("es-ES");
const percentFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

// Visual cue thresholds — agreed with the user as starting points.
const CPL_GOOD = 15;
const CPL_BAD = 25;
const CTR_GOOD = 1.5;
const CTR_BAD = 0.8;

function cplClass(cpl: number, leads: number): string {
  if (leads === 0) return "text-muted-foreground";
  if (cpl <= CPL_GOOD) return "text-emerald-600 dark:text-emerald-400";
  if (cpl >= CPL_BAD) return "text-red-600 dark:text-red-400";
  return "";
}

function ctrClass(ctr: number): string {
  if (ctr >= CTR_GOOD) return "text-emerald-600 dark:text-emerald-400";
  if (ctr > 0 && ctr < CTR_BAD) return "text-red-600 dark:text-red-400";
  return "";
}

function buildAdsManagerUrl(adId: string, accountId: string | null): string | null {
  if (!accountId) return null;
  const act = accountId.replace(/^act_/, "");
  return `https://www.facebook.com/adsmanager/manage/ads/edit?selected_ad_ids=${adId}&act=${act}`;
}

function buildCampaignManagerUrl(campaignId: string, accountId: string | null): string | null {
  if (!accountId || campaignId === "__none__") return null;
  const act = accountId.replace(/^act_/, "");
  return `https://www.facebook.com/adsmanager/manage/campaigns/edit?selected_campaign_ids=${campaignId}&act=${act}`;
}

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

  const isCampaigns = view === "campaigns";
  const adsOverview = isCampaigns
    ? null
    : await getActiveAdsOverview({ since, until, includePaused: showPaused, sort });
  const campaignsOverview = isCampaigns ? await getCampaignsOverview({ since, until, sort }) : null;
  const timeSeries = await getInsightsTimeSeries({ since, until });

  const totals = (adsOverview ?? campaignsOverview)!;
  const {
    totalSpent,
    totalLeads,
    totalImpressions,
    totalClicks,
    avgCpl,
    avgCtr,
    avgCpc,
    lastSyncAt,
  } = totals;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketing y Ads"
        description={`Métricas de anuncios en Meta Ads · ${rangeLabel}.${lastSyncAt ? ` Sincronizado ${relativeTime(lastSyncAt)}.` : ""
          }`}
        actions={<SyncMarketingButton />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MarketingViewTabs current={view} />
          <MarketingRangeSelector current={range} />
        </div>
        <OptionsToolbar sort={sort} showPaused={showPaused} hidePaused={view === "campaigns"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gasto"
          value={formatEUR(totalSpent)}
          tone="default"
          icon={Wallet}
          hint={rangeLabel}
        />
        <StatCard label="Leads (Meta)" value={totalLeads} tone="info" icon={Users} />
        <StatCard
          label="CPL promedio"
          value={totalLeads > 0 ? `${formatEUR(avgCpl)} / lead` : "—"}
          tone={
            totalLeads === 0
              ? "default"
              : avgCpl <= CPL_GOOD
                ? "success"
                : avgCpl >= CPL_BAD
                  ? "danger"
                  : "warning"
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Clics totales"
          value={`${numberFmt.format(totalClicks)} · ${percentFmt.format(avgCtr)}% CTR`}
          tone="default"
          icon={MousePointerClick}
        />
      </div>

      {timeSeries.length > 0 && (
        <SectionBoundary label="No se pudo cargar el gráfico">
          <Card>
            <CardHeader>
              <CardTitle>Evolución diaria</CardTitle>
            </CardHeader>
            <CardContent>
              <InsightsChart data={timeSeries} />
            </CardContent>
          </Card>
        </SectionBoundary>
      )}

      {campaignsOverview ? (
        <CampaignsTable campaigns={campaignsOverview.campaigns} accountId={accountId} />
      ) : adsOverview ? (
        <AdsTable ads={adsOverview.ads} showPaused={showPaused} accountId={accountId} />
      ) : null}

      <p className="text-xs text-muted-foreground">
        Datos atribuidos por Meta (acciones <code>lead</code> y{" "}
        <code>onsite_conversion.lead_grouped</code>). CPC medio: {formatEUR(avgCpc)} · Impresiones:{" "}
        {numberFmt.format(totalImpressions)}.
      </p>
    </div>
  );
}

function AdsTable({
  ads,
  showPaused,
  accountId,
}: {
  ads: ActiveAdRow[];
  showPaused: boolean;
  accountId: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anuncios {showPaused ? "(activos + pausados)" : "activos"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anuncio</TableHead>
              <TableHead>Campaña</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Impresiones</TableHead>
              <TableHead className="text-right">Clics</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="w-[88px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                  No hay anuncios con datos en el rango seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              ads.map((ad) => {
                const adsManagerUrl = buildAdsManagerUrl(ad.id, accountId);
                const isPaused = ad.status !== "ACTIVE";
                return (
                  <TableRow key={ad.id} className={cn(isPaused && "opacity-60")}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {ad.preview_url && (
                          // biome-ignore lint/performance/noImgElement: external Meta CDN, no Next image loader configured for it
                          <img
                            src={ad.preview_url}
                            className="h-8 w-8 rounded object-cover"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <span className="truncate">{ad.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ad.campaignName}</TableCell>
                    <TableCell>
                      <Badge variant={isPaused ? "outline" : "success"}>{ad.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(ad.impressions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(ad.clicks)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", ctrClass(ad.ctr))}>
                      {percentFmt.format(ad.ctr)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ad.clicks > 0 ? formatEUR(ad.cpc) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEUR(ad.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ad.leads}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        cplClass(ad.cpl, ad.leads),
                      )}
                    >
                      {ad.leads > 0 ? formatEUR(ad.cpl) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <AdPreviewDialog
                          adId={ad.id}
                          adName={ad.name}
                          campaignName={ad.campaignName}
                          adsManagerUrl={adsManagerUrl}
                        />
                        {adsManagerUrl ? (
                          <Button asChild variant="ghost" size="icon-sm">
                            <a
                              href={adsManagerUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Abrir en Meta Ads Manager"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CampaignsTable({
  campaigns,
  accountId,
}: {
  campaigns: CampaignRow[];
  accountId: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campañas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead className="text-right">Anuncios</TableHead>
              <TableHead className="text-right">Impresiones</TableHead>
              <TableHead className="text-right">Clics</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="w-16 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                  No hay campañas con datos en el rango seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => {
                const url = buildCampaignManagerUrl(c.id, accountId);
                const isPaused = c.status !== "ACTIVE";
                return (
                  <TableRow key={c.id} className={cn(isPaused && "opacity-60")}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.activeAdCount}/{c.adCount} anuncios activos
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.objective ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.adCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(c.impressions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(c.clicks)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", ctrClass(c.ctr))}>
                      {percentFmt.format(c.ctr)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.clicks > 0 ? formatEUR(c.cpc) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEUR(c.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.leads}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        cplClass(c.cpl, c.leads),
                      )}
                    >
                      {c.leads > 0 ? formatEUR(c.cpl) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {url ? (
                        <Button asChild variant="ghost" size="icon-sm">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Abrir campaña en Meta Ads Manager"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
