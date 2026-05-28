"use server";

import { syncMetaCatalog, syncMetaInsights } from "@/lib/marketing-sync";

export async function syncMetaAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const catalogResult = await syncMetaCatalog();
    if (!catalogResult.ok) {
      return { ok: false, error: catalogResult.error ?? "Error al sincronizar catálogo" };
    }

    const today = new Date().toISOString().split("T")[0] ?? "";
    const thirtyDaysAgo =
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "";

    const insightsResult = await syncMetaInsights(thirtyDaysAgo, today);
    if (!insightsResult.ok) {
      return { ok: false, error: insightsResult.error ?? "Error al sincronizar métricas" };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado en la sincronización" };
  }
}
