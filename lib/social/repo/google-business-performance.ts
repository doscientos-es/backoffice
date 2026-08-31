import { scopedLogger } from '@/lib/logger'
import { googleBusinessLocationId } from '@/lib/social/google-business/client'
import type { GoogleBusinessDailyMetricValue } from '@/lib/social/google-business/performance'
import type { GoogleBusinessMetricView } from '@/lib/social/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('social-repo-google-performance')

interface MetricRow {
  metric: string
  metric_date: string
  value: number
  fetched_at: string
}

function mapMetric(row: MetricRow): GoogleBusinessMetricView {
  return {
    metric: row.metric,
    date: row.metric_date,
    value: Number(row.value),
    fetchedAt: row.fetched_at,
  }
}

export async function upsertGoogleBusinessMetrics(
  metrics: GoogleBusinessDailyMetricValue[],
): Promise<number> {
  if (metrics.length === 0) return 0
  const fetchedAt = new Date().toISOString()
  const supabase = createAdminClient()
  const { error } = await supabase.from('google_business_profile_metrics').upsert(
    metrics.map((metric) => ({
      location_id: googleBusinessLocationId(),
      metric: metric.metric,
      metric_date: metric.date,
      value: metric.value,
      fetched_at: fetchedAt,
    })),
    { onConflict: 'location_id, metric, metric_date' },
  )
  if (error) {
    log.error({ err: error.message }, 'upsert_google_business_metrics_failed')
    throw new Error(`No se pudieron guardar las métricas de Google: ${error.message}`)
  }
  return metrics.length
}

export async function listGoogleBusinessMetrics(days = 30): Promise<GoogleBusinessMetricView[]> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - Math.max(1, Math.min(days, 90)))
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('google_business_profile_metrics')
    .select('metric, metric_date, value, fetched_at')
    .eq('location_id', googleBusinessLocationId())
    .gte('metric_date', since.toISOString().slice(0, 10))
    .order('metric_date', { ascending: true })
  if (error) {
    log.error({ err: error.message }, 'list_google_business_metrics_failed')
    return []
  }
  return (data as unknown as MetricRow[]).map(mapMetric)
}
