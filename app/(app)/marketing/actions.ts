"use server";

import { requireUser } from "@/lib/auth";
import {
  type MetaAdPreviewFormat,
  getMetaAdPreview,
} from "@/lib/integrations/meta-marketing";
import { syncMetaCatalog, syncMetaInsights } from "@/lib/marketing-sync";
import { parseMarketingRange, rangeToDates } from "@/lib/marketing/range";

export async function syncMetaAction(
  rangeKey?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  try {
    const catalogResult = await syncMetaCatalog();
    if (!catalogResult.ok) {
      return { ok: false, error: catalogResult.error ?? "Error al sincronizar catálogo" };
    }

    // Always sync at least the last 90 days so any range smaller than that
    // has fresh data without re-hitting the API on every range switch.
    const { since: requestedSince } = rangeToDates(parseMarketingRange(rangeKey));
    const today = new Date().toISOString().split("T")[0] ?? "";
    const ninetyDaysAgo =
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "";
    const since = requestedSince < ninetyDaysAgo ? requestedSince : ninetyDaysAgo;

    const insightsResult = await syncMetaInsights(since, today);
    if (!insightsResult.ok) {
      return { ok: false, error: insightsResult.error ?? "Error al sincronizar métricas" };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado en la sincronización",
    };
  }
}

export async function getAdPreviewAction(
  adId: string,
  format: MetaAdPreviewFormat = "DESKTOP_FEED_STANDARD",
): Promise<{ ok: true; body: string | null } | { ok: false; error: string }> {
  await requireUser();
  try {
    const body = await getMetaAdPreview(adId, format);
    return { ok: true, body };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error obteniendo la previa del anuncio",
    };
  }
}


