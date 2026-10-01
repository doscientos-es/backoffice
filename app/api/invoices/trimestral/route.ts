import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import {
  loadQuarterlyAdvisorData,
  parseQuarterlyCsvScope,
  quarterlyAdvisorCsv,
  quarterlyAdvisorFilename,
  quarterlyAdvisorWorkbook,
} from '@/lib/exports/quarterly-advisor'
import { quarterlyPeriod } from '@/lib/exports/quarterly-invoices'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('api.invoices.trimestral')
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Creates the accountant register for one calendar quarter as CSV (default) or Excel (`format=xlsx`). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = quarterlyPeriod(searchParams.get('year'), searchParams.get('quarter'))
  if (!period) {
    return NextResponse.json(
      { error: 'Indica un año YYYY y un trimestre entre 1 y 4' },
      { status: 400 },
    )
  }

  const format = searchParams.get('format') ?? 'csv'
  if (format !== 'csv' && format !== 'xlsx') {
    return NextResponse.json({ error: 'Formato no soportado (csv o xlsx)' }, { status: 400 })
  }

  const scope = parseQuarterlyCsvScope(searchParams.get('scope'))
  if (!scope) {
    return NextResponse.json(
      { error: 'Alcance no soportado (all, income o expenses)' },
      { status: 400 },
    )
  }

  try {
    const data = await loadQuarterlyAdvisorData(period)
    const logContext = {
      quarter: period.label,
      invoices: data.invoices.length,
      expenseAttachments: data.attachments.length,
    }

    if (format === 'xlsx') {
      const workbook = quarterlyAdvisorWorkbook(data)
      log.info(logContext, 'quarterly_advisor_xlsx_exported')
      return new NextResponse(new Uint8Array(workbook), {
        headers: {
          'Content-Type': XLSX_CONTENT_TYPE,
          'Content-Disposition': `attachment; filename="${quarterlyAdvisorFilename(period, 'xlsx')}"`,
        },
      })
    }

    const csv = quarterlyAdvisorCsv(data, scope)
    const filename = quarterlyAdvisorFilename(period, 'csv', scope)
    log.info(logContext, 'quarterly_advisor_csv_exported')
    return new NextResponse(new TextDecoder().decode(csv), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    log.error({ err: error, quarter: period.label }, 'quarterly_advisor_archive_failed')
    return NextResponse.json({ error: 'No se pudo generar el archivo trimestral' }, { status: 500 })
  }
}
