import { createAdminClient } from "@/lib/supabase/admin";
import { formatEUR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, TrendingUp, Users, Wallet } from "lucide-react";
import { SyncMarketingButton } from "./sync-button";

export default async function MarketingPage() {
  const supabase = createAdminClient();

  // Get active ads and their basic stats
  const { data: ads } = await supabase
    .from("marketing_ads")
    .select(`
      id,
      name,
      status,
      preview_url,
      marketing_campaigns (name),
      marketing_insights (spend, impressions, clicks)
    `)
    .eq("status", "ACTIVE");

  // Get lead counts per ad_id
  const { data: leadsByAd } = await supabase
    .from("leads")
    .select("utm_content")
    .not("utm_content", "is", null);

  const leadCounts = (leadsByAd || []).reduce((acc: Record<string, number>, lead) => {
    const adId = lead.utm_content as string;
    acc[adId] = (acc[adId] || 0) + 1;
    return acc;
  }, {});

  // Calculate totals
  const processedAds = (ads || []).map(ad => {
    const insights = (ad.marketing_insights as any[]) || [];
    const totalSpend = insights.reduce((sum, i) => sum + (i.spend || 0), 0);
    const totalLeads = leadCounts[ad.id] || 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    return {
      ...ad,
      campaignName: (ad.marketing_campaigns as any)?.name || "Sin campaña",
      spend: totalSpend,
      leads: totalLeads,
      cpl
    };
  });

  const totalSpent = processedAds.reduce((sum, ad) => sum + ad.spend, 0);
  const totalLeads = Object.values(leadCounts).reduce((sum, c) => sum + c, 0);
  const avgCpl = totalLeads > 0 ? totalSpent / totalLeads : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Centro de Control de Marketing</h1>
        <SyncMarketingButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Total Acumulado</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEUR(totalSpent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Totales (Meta)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPL Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEUR(avgCpl)} / lead</div>
          </CardContent>
        </Card>
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
              {processedAds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se han sincronizado anuncios activos todavía.
                  </TableCell>
                </TableRow>
              ) : (
                processedAds.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {ad.preview_url && (
                          <img src={ad.preview_url} className="h-8 w-8 rounded object-cover" alt="" />
                        )}
                        <span>{ad.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ad.campaignName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        {ad.status}
                      </Badge>
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
