import { type NextRequest, NextResponse } from 'next/server'

import { writeAuditEvent } from '@/lib/audit/events'
import { requireRole } from '@/lib/auth'
import {
  isExportableTable,
  streamOperationalDataAsJson,
  streamTableAsCsv,
} from '@/lib/exports/data'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('api.data-export')

function download(body: BodyInit, contentType: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')
  const stamp = new Date().toISOString().slice(0, 10)
  const includePii = searchParams.get('includePii') === 'true'

  if (includePii && user.role !== 'owner') {
    return NextResponse.json({ error: 'Solo un owner puede incluir datos personales' }, { status: 403 })
  }

  try {
    if (format === 'json') {
      await writeAuditEvent({
        actorId: user.id,
        actorRole: user.role,
        entityType: 'operational_data',
        action: 'exported',
        metadata: { format, piiIncluded: includePii, scope: 'all_tables' },
        requestId: request.headers.get('x-request-id') ?? request.headers.get('x-vercel-id'),
      })
      log.info({ piiIncluded: includePii }, 'operational_data_export_stream_started')
      return download(
        streamOperationalDataAsJson({ includePii }),
        'application/json; charset=utf-8',
        `doscientos-datos-${stamp}.json`,
      )
    }

    const table = searchParams.get('table')
    if (format !== 'csv' || !isExportableTable(table)) {
      return NextResponse.json({ error: 'Formato o tabla no válidos' }, { status: 400 })
    }

    await writeAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      entityType: table,
      action: 'exported',
      metadata: { format, piiIncluded: includePii, scope: 'single_table' },
      requestId: request.headers.get('x-request-id') ?? request.headers.get('x-vercel-id'),
    })
    log.info({ table, piiIncluded: includePii }, 'operational_data_export_stream_started')
    return download(
      streamTableAsCsv(table, { includePii }),
      'text/csv; charset=utf-8',
      `doscientos-${table}-${stamp}.csv`,
    )
  } catch (error) {
    log.error({ err: error }, 'operational_data_export_failed')
    return NextResponse.json({ error: 'No se pudo generar la exportación' }, { status: 500 })
  }
}
