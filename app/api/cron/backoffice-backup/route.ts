import { type NextRequest, NextResponse } from 'next/server'

import { runBackofficeBackup } from '@/lib/backups/backoffice'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.backoffice-backup')

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET]))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    await runBackofficeBackup()
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ err: error }, 'backoffice_backup_failed')
    return NextResponse.json({ error: 'backoffice_backup_failed' }, { status: 500 })
  }
}
