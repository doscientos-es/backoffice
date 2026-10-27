import { type NextRequest, NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { processDueEmailMarketing } from '@/lib/marketing/email-marketing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.email-marketing')

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET]))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const result = await processDueEmailMarketing()
    log.info(result, 'email marketing queue processed')
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 200 })
  } catch (error) {
    log.error({ err: error }, 'email marketing queue failed')
    return NextResponse.json({ error: 'email_marketing_failed' }, { status: 500 })
  }
}
