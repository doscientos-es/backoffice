import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { getActiveAdsOverview } from "@/lib/marketing/queries";
import { formatEUR } from "@/lib/utils";
import { TrendingUp, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { SyncMarketingButton } from "./sync-button";

export const metadata: Metadata = { title: "Marketing · doscientos" };
export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  await requireUser();
  const { ads, totalSpent, totalLeads, avgCpl } = await getActiveAdsOverview();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketing y Ads"
        description="Métricas de anuncios activos en Meta Ads."
        actions={<SyncMarketingButton />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Gasto total acumulado"
          value={formatEUR(totalSpent)}
          tone="default"
          icon={Wallet}
        />
        <StatCard label="Leads totales (Meta)" value={totalLeads} tone="info" icon={Users} />
        <StatCard
          label="CPL Promedio"
          value={`${formatEUR(avgCpl)} / lead`}
          tone={avgCpl < 15 ? "success" : "warning"}
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anuncios Activos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anuncio</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No se han sincronizado anuncios activos todavía.
                  </TableCell>
                </TableRow>
              ) : (
                ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {ad.preview_url && (
                          <img
                            src={ad.preview_url}
                            className="h-8 w-8 rounded object-cover"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <span>{ad.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ad.campaignName}</TableCell>
                    <TableCell>
                      <Badge variant="success">{ad.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatEUR(ad.spend)}</TableCell>
                    <TableCell className="text-right">{ad.leads}</TableCell>
                    <TableCell className="text-right font-bold">{formatEUR(ad.cpl)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
