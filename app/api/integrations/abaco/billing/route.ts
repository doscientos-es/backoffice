import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { abacoSubscriptionEvent } from '@/lib/invoices/abaco-subscription-event'
import {
  fulfillAbacoSubscription,
  prepareAbacoSubscription,
} from '@/lib/invoices/abaco-subscription-fulfillment'
import { scopedLogger } from '@/lib/logger'

export const runtime = 'nodejs'

const log = scopedLogger('integrations.abaco.billing')

export async function POST(request: Request): Promise<Response> {
  const env = serverEnv()
  const secret = env.MENOSLIOS_BILLING_SECRET || env.ABACO_BILLING_SECRET
  if (secret.length < 32 || !isAuthorizedCronRequest(request, [secret])) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const event = abacoSubscriptionEvent.safeParse(await request.json().catch(() => null))
  if (!event.success) return Response.json({ error: 'invalid_request' }, { status: 422 })

  try {
    const input = event.data
    if (input.action === 'prepare') {
      return Response.json({
        status: await prepareAbacoSubscription(input.tenantId, input.recipient),
      })
    }
    return Response.json(await fulfillAbacoSubscription(input.payment))
  } catch {
    // The upstream error can contain a customer's fiscal data, so do not log it.
    log.error({ action: event.data.action }, 'abaco_billing_request_failed')
    return Response.json({ error: 'billing_unavailable' }, { status: 503 })
  }
}
