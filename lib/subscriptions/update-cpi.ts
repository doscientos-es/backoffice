import { createAdminClient } from '@/lib/supabase/admin'

import { fetchLatestCpiRate, madridCalendar } from './cpi'

export type SubscriptionCpiUpdateResult = {
  status: 'skipped' | 'applied'
  adjustmentYear: number
  rate: number | null
  subscriptionsUpdated: number
}

/**
 * Applies the annual CPI revision during January. The database function owns
 * the idempotency guarantee, so retries and concurrent cron calls are safe.
 */
export async function updateSubscriptionsByCpi(
  date = new Date(),
): Promise<SubscriptionCpiUpdateResult> {
  const { year, month } = madridCalendar(date)
  if (month !== 1) {
    return { status: 'skipped', adjustmentYear: year, rate: null, subscriptionsUpdated: 0 }
  }

  const rate = await fetchLatestCpiRate()
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('apply_subscription_cpi_update', {
    p_adjustment_year: year,
    p_rate: rate,
    p_source: 'INE:IPC290750',
  })

  if (error) throw new Error(error.message)

  const result = Array.isArray(data) ? data[0] : data
  return {
    status: 'applied',
    adjustmentYear: year,
    rate,
    subscriptionsUpdated:
      result && typeof result.subscriptions_updated === 'number' ? result.subscriptions_updated : 0,
  }
}
