import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import {
  createZip,
  csvWithBom,
  expenseArchiveFilename,
  quarterlyPeriod,
  safeFilePart,
  type ZipEntry,
} from '@/lib/exports/quarterly-invoices'
import { renderInvoicePdf } from '@/lib/invoices/invoice-pdf-document'
import { buildInvoicePdfData, invoicePdfFilename } from '@/lib/invoices/pdf-data'
import { findWorkLogsForInvoice, getInvoiceDetail } from '@/lib/invoices/queries'
import { scopedLogger } from '@/lib/logger'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('api.invoices.trimestral')
const EXPORTABLE_INVOICE_STATUSES = ['issued', 'paid', 'overdue', 'rectified']

type QuarterlyInvoice = {
  id: string
  full_number: string | null
  issue_date: string | null
  client_name: string | null
  client_nif: string | null
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  status: string | null
  verifactu_status: string | null
  verifactu_csv: string | null
}

type QuarterlyExpense = {
  id: string
  vendor: string
  category: string | null
  expense_date: string
  invoice_reference: string | null
  vendor_nif: string | null
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  currency: string | null
}

type ExpenseAttachment = {
  id: string
  expense_id: string
  name: string
  mime_type: string | null
  size_bytes: number | null
  storage_path: string | null
  source: 'storage' | 'drive' | null
  web_view_link: string | null
}

/** Creates the manual accountant package for one calendar quarter. */
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

  try {
    const supabase = await createServerClient()
    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          'id, full_number, issue_date, client_name, client_nif, subtotal, tax_amount, total, status, verifactu_status, verifactu_csv',
        )
        .is('deleted_at', null)
        .in('status', EXPORTABLE_INVOICE_STATUSES)
        .gte('issue_date', period.start)
        .lt('issue_date', period.end)
        .order('issue_date', { ascending: true })
        .order('full_number', { ascending: true }),
      supabase
        .from('expenses')
        .select(
          'id, vendor, category, expense_date, invoice_reference, vendor_nif, subtotal, tax_amount, total, currency',
        )
        .is('deleted_at', null)
        .gte('expense_date', period.start)
        .lt('expense_date', period.end)
        .order('expense_date', { ascending: true })
        .order('vendor', { ascending: true }),
    ])
    if (invoicesResult.error) throw new Error(invoicesResult.error.message)
    if (expensesResult.error) throw new Error(expensesResult.error.message)

    const invoices = (invoicesResult.data ?? []) as unknown as QuarterlyInvoice[]
    const expenses = (expensesResult.data ?? []) as unknown as QuarterlyExpense[]
    const expenseIds = expenses.map((expense) => expense.id)
    const attachmentsResult =
      expenseIds.length === 0
        ? { data: [] as ExpenseAttachment[], error: null }
        : await supabase
            .from('attachments')
            .select(
              'id, expense_id, name, mime_type, size_bytes, storage_path, source, web_view_link',
            )
            .is('deleted_at', null)
            .in('expense_id', expenseIds)
            .order('name', { ascending: true })
    if (attachmentsResult.error) throw new Error(attachmentsResult.error.message)
    const attachments = (attachmentsResult.data ?? []) as unknown as ExpenseAttachment[]

    const expenseById = new Map(expenses.map((expense) => [expense.id, expense]))
    const entries: ZipEntry[] = [
      {
        name: 'gastos/metadatos.csv',
        body: csvWithBom(
          attachments.map((attachment) => {
            const expense = expenseById.get(attachment.expense_id)
            const stored = attachment.source !== 'drive' && Boolean(attachment.storage_path)
            return {
              'Archivo ZIP': stored
                ? `gastos/${expenseArchiveFilename({
                    id: attachment.id,
                    date: expense?.expense_date ?? period.start,
                    vendor: expense?.vendor ?? 'proveedor',
                    reference: expense?.invoice_reference ?? null,
                    name: attachment.name,
                  })}`
                : '',
              'Estado archivo': stored ? 'Adjunto incluido' : 'Solo enlace de Drive',
              Archivo: attachment.name,
              Fecha: expense?.expense_date ?? '',
              Proveedor: expense?.vendor ?? '',
              'NIF proveedor': expense?.vendor_nif ?? '',
              'Nº factura proveedor': expense?.invoice_reference ?? '',
              Categoría: expense?.category ?? '',
              Base: Number(expense?.subtotal ?? 0).toFixed(2),
              IVA: Number(expense?.tax_amount ?? 0).toFixed(2),
              Total: Number(expense?.total ?? 0).toFixed(2),
              Moneda: expense?.currency ?? 'EUR',
              'Tipo MIME': attachment.mime_type ?? '',
              'Tamaño (bytes)': attachment.size_bytes ?? '',
              'Enlace Drive': attachment.web_view_link ?? '',
            }
          }),
        ),
      },
      {
        name: 'cobros/metadatos.csv',
        body: csvWithBom(
          invoices.map((invoice) => ({
            'Archivo ZIP': `cobros/${invoice.issue_date ?? period.start}_${invoicePdfFilename(invoice.full_number, invoice.id)}`,
            'Nº factura': invoice.full_number ?? '',
            Fecha: invoice.issue_date ?? '',
            Cliente: invoice.client_name ?? '',
            'NIF cliente': invoice.client_nif ?? '',
            Base: Number(invoice.subtotal ?? 0).toFixed(2),
            IVA: Number(invoice.tax_amount ?? 0).toFixed(2),
            Total: Number(invoice.total ?? 0).toFixed(2),
            Estado: invoice.status ?? '',
            'Estado Verifactu': invoice.verifactu_status ?? '',
            'CSV Verifactu': invoice.verifactu_csv ?? '',
          })),
        ),
      },
    ]

    const storage = getStorage()
    for (const attachment of attachments) {
      const expense = expenseById.get(attachment.expense_id)
      if (!expense || attachment.source === 'drive' || !attachment.storage_path) continue
      const { data, error } = await storage.download('documents', attachment.storage_path)
      if (error || !data) throw new Error(error ?? `No se pudo descargar ${attachment.name}`)
      entries.push({
        name: `gastos/${expenseArchiveFilename({
          id: attachment.id,
          date: expense.expense_date,
          vendor: expense.vendor,
          reference: expense.invoice_reference,
          name: attachment.name,
        })}`,
        body: new Uint8Array(data),
        modifiedAt: new Date(`${expense.expense_date}T12:00:00`),
      })
    }

    for (const invoice of invoices) {
      const detail = await getInvoiceDetail(invoice.id)
      if (!detail)
        throw new Error(`No se pudo obtener la factura ${invoice.full_number ?? invoice.id}`)
      const workLogs = await findWorkLogsForInvoice(invoice.id)
      const pdfData = await buildInvoicePdfData({
        invoice: detail.invoice,
        clientName: detail.invoice.client?.name ?? invoice.client_name,
        clientLogoUrl: detail.invoice.client?.logo_url ?? null,
        items: detail.items,
        settings: detail.settings,
        workLogs,
      })
      entries.push({
        name: `cobros/${invoice.issue_date ?? period.start}_${invoicePdfFilename(invoice.full_number, invoice.id)}`,
        body: await renderInvoicePdf(pdfData),
        modifiedAt: new Date(`${invoice.issue_date ?? period.start}T12:00:00`),
      })
    }

    const archive = createZip(entries)
    const filename = `doscientos-${safeFilePart(period.label.replace(' ', '-'), 'trimestre')}.zip`
    log.info(
      { quarter: period.label, invoices: invoices.length, expenseAttachments: attachments.length },
      'quarterly_advisor_archive_exported',
    )
    return new NextResponse(new Uint8Array(archive), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    log.error({ err: error, quarter: period.label }, 'quarterly_advisor_archive_failed')
    return NextResponse.json({ error: 'No se pudo generar el archivo trimestral' }, { status: 500 })
  }
}
