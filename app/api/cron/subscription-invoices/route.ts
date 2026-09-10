/**
 * GET /api/cron/subscription-invoices
 *
 * Creates draft invoices for every active subscription due today or earlier.
 * Called daily by the repository workflow; safe to retry.
 */

import { type NextRequest, NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { generateDueSubscriptionInvoices } from '@/lib/subscriptions/generate-invoices'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.subscription-invoices')

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET])) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateDueSubscriptionInvoices()
    log.info(
      {
        checked: result.checked,
        generated: result.generated.length,
        failed: result.failures.length,
      },
      'subscription invoices cron executed',
    )
    return NextResponse.json(result, { status: result.failures.length > 0 ? 207 : 200 })
  } catch (error) {
    log.error({ err: error }, 'subscription invoices cron failed')
    return NextResponse.json({ error: 'subscription_invoice_generation_failed' }, { status: 500 })
  }
}
