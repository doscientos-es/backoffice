"use client";

import { syncMetaCatalog, syncMetaInsights } from "@/lib/marketing-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SyncMarketingButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    try {
      // Sync catalog first
      const catalogResult = await syncMetaCatalog();
      if (!catalogResult.ok) throw new Error(catalogResult.error);

      // Sync insights for last 30 days
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      const insightsResult = await syncMetaInsights(thirtyDaysAgo, today);
      if (!insightsResult.ok) throw new Error(insightsResult.error);

      toast.success("Sincronización completada con éxito");
      router.refresh();
    } catch (err) {
      toast.error("Error al sincronizar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleSync} disabled={loading} variant="outline" size="sm">
      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      Sincronizar Meta Ads
    </Button>
  );
}
