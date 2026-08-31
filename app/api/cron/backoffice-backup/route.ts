import { type NextRequest, NextResponse } from 'next/server'

import { runBackofficeBackup } from '@/lib/backups/backoffice'
import { isDemoMode } from '@/lib/demo'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.backoffice-backup')

function authenticate(request: NextRequest): boolean {
  const { CRON_SECRET } = serverEnv()
  if (!CRON_SECRET) return false
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization
  return token === CRON_SECRET
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authenticate(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (isDemoMode()) return NextResponse.json({ ok: true, mocked: true })

  try {
    const result = await runBackofficeBackup()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    log.error({ err: error }, 'backoffice_backup_failed')
    return NextResponse.json({ error: 'backoffice_backup_failed' }, { status: 500 })
  }
}
