import { type NextRequest, NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { sendDailyResponsibilityNotifications } from '@/lib/notifications/daily-responsibilities'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.daily-responsibilities')

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET]))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const result = await sendDailyResponsibilityNotifications()
    log.info(result, 'daily responsibility notifications sent')
    return NextResponse.json(result)
  } catch (error) {
    log.error({ err: error }, 'daily responsibility notifications failed')
    return NextResponse.json({ error: 'daily_responsibilities_failed' }, { status: 500 })
  }
}
