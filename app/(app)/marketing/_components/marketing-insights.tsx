import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInsightsTimeSeries } from "@/lib/marketing/queries";
import { InsightsChart } from "../insights-chart";

export async function MarketingInsights({ since, until }: { since: string; until: string }) {
  const timeSeries = await getInsightsTimeSeries({ since, until });
  if (timeSeries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución diaria</CardTitle>
      </CardHeader>
      <CardContent>
        <InsightsChart data={timeSeries} />
      </CardContent>
    </Card>
  );
}
