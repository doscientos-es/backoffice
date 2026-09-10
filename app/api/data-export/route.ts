import { type NextRequest, NextResponse } from 'next/server'

import { writeAuditEvent } from '@/lib/audit/events'
import { requireRole } from '@/lib/auth'
import {
  EXPORT_LINK_TTL_SECONDS,
  createExportDownloadSignature,
  isValidExportDownloadSignature,
} from '@/lib/exports/download-link'
import {
  type ExportableTable,
  isExportableTable,
  streamOperationalDataAsJson,
  streamTableAsCsv,
} from '@/lib/exports/data'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('api.data-export')

type ExportFormat = 'json' | 'csv'
type ExportRequest =
  | { format: 'json'; table: null; includePii: boolean }
  | { format: 'csv'; table: ExportableTable; includePii: boolean }

function download(body: BodyInit, contentType: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function parseExportRequest(params: URLSearchParams): ExportRequest | null {
  const format = params.get('format')
  const table = params.get('table')
  const includePii = params.get('includePii') === 'true'
  if (format === 'json' && !table) return { format, table: null, includePii }
  if (format === 'csv' && isExportableTable(table)) return { format, table, includePii }
  return null
}

async function requireExportUser() {
  try {
    return await requireRole(['owner', 'admin'])
  } catch {
    return null
  }
}

function canExport(request: ExportRequest, role: string): boolean {
  return !request.includePii || role === 'owner'
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireExportUser()
  if (!user) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const params = new URLSearchParams()
  if (typeof body?.format === 'string') params.set('format', body.format)
  if (typeof body?.table === 'string') params.set('table', body.table)
  if (body?.includePii === true) params.set('includePii', 'true')
  const exportRequest = parseExportRequest(params)
  if (!exportRequest) return NextResponse.json({ error: 'Formato o tabla no válidos' }, { status: 400 })
  if (!canExport(exportRequest, user.role)) {
    return NextResponse.json({ error: 'Solo un owner puede incluir datos personales' }, { status: 403 })
  }

  const expiresAt = Math.floor(Date.now() / 1_000) + EXPORT_LINK_TTL_SECONDS
  const signature = createExportDownloadSignature({ ...exportRequest, userId: user.id, expiresAt })
  const url = new URL('/api/data-export', request.url)
  url.searchParams.set('format', exportRequest.format)
  if (exportRequest.table) url.searchParams.set('table', exportRequest.table)
  if (exportRequest.includePii) url.searchParams.set('includePii', 'true')
  url.searchParams.set('expires', String(expiresAt))
  url.searchParams.set('signature', signature)

  await writeAuditEvent({
    actorId: user.id,
    actorRole: user.role,
    entityType: exportRequest.table ?? 'operational_data',
    action: 'export_link_issued',
    metadata: { format: exportRequest.format, piiIncluded: exportRequest.includePii, expiresAt },
  })
  return NextResponse.json({ downloadUrl: url.pathname + url.search, expiresAt })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const exportRequest = parseExportRequest(searchParams)
  if (!exportRequest) return NextResponse.json({ error: 'Formato o tabla no válidos' }, { status: 400 })

  const user = await requireExportUser()
  if (!user) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  if (!canExport(exportRequest, user.role)) {
    return NextResponse.json({ error: 'Solo un owner puede incluir datos personales' }, { status: 403 })
  }

  const expiresAt = Number(searchParams.get('expires'))
  const signature = searchParams.get('signature') ?? ''
  if (
    !Number.isInteger(expiresAt) ||
    expiresAt < Math.floor(Date.now() / 1_000) ||
    !isValidExportDownloadSignature({ ...exportRequest, userId: user.id, expiresAt }, signature)
  ) {
    return NextResponse.json({ error: 'Enlace de descarga inválido o caducado' }, { status: 401 })
  }

  const stamp = new Date().toISOString().slice(0, 10)

  try {
    if (exportRequest.format === 'json') {
      await writeAuditEvent({
        actorId: user.id,
        actorRole: user.role,
        entityType: 'operational_data',
        action: 'exported',
        metadata: { format: exportRequest.format, piiIncluded: exportRequest.includePii, scope: 'all_tables' },
        requestId: request.headers.get('x-request-id') ?? request.headers.get('x-vercel-id'),
      })
      log.info({ piiIncluded: exportRequest.includePii }, 'operational_data_export_stream_started')
      return download(
        streamOperationalDataAsJson({ includePii: exportRequest.includePii }),
        'application/json; charset=utf-8',
        `doscientos-datos-${stamp}.json`,
      )
    }

    await writeAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      entityType: exportRequest.table,
      action: 'exported',
      metadata: { format: exportRequest.format, piiIncluded: exportRequest.includePii, scope: 'single_table' },
      requestId: request.headers.get('x-request-id') ?? request.headers.get('x-vercel-id'),
    })
    log.info({ table: exportRequest.table, piiIncluded: exportRequest.includePii }, 'operational_data_export_stream_started')
    return download(
      streamTableAsCsv(exportRequest.table!, { includePii: exportRequest.includePii }),
      'text/csv; charset=utf-8',
      `doscientos-${exportRequest.table}-${stamp}.csv`,
    )
  } catch (error) {
    log.error({ err: error }, 'operational_data_export_failed')
    return NextResponse.json({ error: 'No se pudo generar la exportación' }, { status: 500 })
  }
}
