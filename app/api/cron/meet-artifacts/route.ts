import { NextResponse, type NextRequest } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.meet-artifacts')

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET])) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { importRecentMeetArtifacts } = await import('@/lib/integrations/import-meet-artifacts')
    return NextResponse.json(await importRecentMeetArtifacts())
  } catch (err) {
    log.error({ err }, 'meet_artifact_import_failed')
    return NextResponse.json({ error: 'meet_artifact_import_failed' }, { status: 500 })
  }
}
