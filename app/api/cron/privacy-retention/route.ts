import { type NextRequest, NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { processDuePrivacyErasures } from '@/lib/privacy/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.privacy-retention')

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET]))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const summary = await processDuePrivacyErasures()
    log.info(summary, 'privacy retention cron executed')
    return NextResponse.json(summary, { status: summary.failed > 0 ? 207 : 200 })
  } catch (error) {
    log.error({ err: error }, 'privacy retention cron failed')
    return NextResponse.json({ error: 'privacy_retention_failed' }, { status: 500 })
  }
}