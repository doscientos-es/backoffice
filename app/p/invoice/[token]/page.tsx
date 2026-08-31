import { buildQrDataUrl, buildQrUrl } from '@doscientos/verifactu'
import { CircleCheck as CheckCircle2, Download, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { InvoiceItemsSummary } from '@/components/finance/invoice-items-summary'
import { InvoicePaymentOptions } from '@/components/portal/invoice-payment-options'
import { PortalPasswordGate } from '@/components/portal/password-gate'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getCurrentUser } from '@/lib/auth'
import { buildVatBreakdown } from '@/lib/finance'
import { isPortalUnlocked } from '@/lib/portal/access'
import { INVOICE_STATUS } from '@/lib/status'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatEUR } from '@/lib/utils'
import { verifactuInvoiceConfigFromEnv } from '@/lib/verifactu/config'

import { unlockInvoicePortal } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Factura · doscientos',
  robots: { index: false, follow: false },
}

type InvoiceItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  subtotal: number
}

export default async function PortalInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { token } = await params
  const { success, error: paymentError } = await searchParams
  const admin = createAdminClient()

  // Resolve auth first so team members can preview drafts.
  const auth = await getCurrentUser()
  const isTeam = auth.ok

  const { data: invoice } = await admin
    .from('invoices')
    .select('*, clients(name, logo_url)')
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  // Drafts are only accessible to authenticated team members.
  if (!invoice || (invoice.status === 'draft' && !isTeam)) notFound()

  // Client-facing access gate: hidden invoices 404 and password-protected ones
  // show the unlock form until the visitor presents a valid cookie. Team
  // members always bypass so they can preview the link.
  if (!isTeam) {
    if ((invoice.is_client_visible as boolean | null) === false) notFound()
    const unlocked = await isPortalUnlocked(
      token,
      (invoice.portal_password_hash as string | null) ?? null,
    )
    if (!unlocked) {
      return <PortalPasswordGate token={token} action={unlockInvoicePortal} />
    }
  }

  const { data: items } = await admin
    .from('invoice_items')
    .select('id, position, description, quantity, unit_price, vat_rate, subtotal')
    .eq('invoice_id', invoice.id as string)
    .order('position')

  const { data: workLogs } = await admin
    .from('work_logs')
    .select('id, work_date, hours, start_time, end_time, note')
    .eq('invoice_id', invoice.id as string)
    .is('deleted_at', null)
    .order('work_date', { ascending: true })

  const { data: settings } = await admin.from('settings').select('*').eq('id', 1).maybeSingle()

  const client = (
    invoice as unknown as { clients: { name: string; logo_url: string | null } | null }
  ).clients
  const safeItems = (items ?? []) as unknown as InvoiceItem[]

  // Group line items by VAT rate so we can show a proper desglose por tipo.
  const vatBreakdown = buildVatBreakdown(safeItems)

  let qrDataUrl: string | null = null
  if (invoice.verifactu_status === 'accepted') {
    try {
      const persistedQrUrl = typeof invoice.qr_url === 'string' ? invoice.qr_url.trim() : ''
      if (persistedQrUrl) {
        qrDataUrl = await buildQrDataUrl(persistedQrUrl)
      } else {
        const emisorNif = (settings?.company_nif as string | null) ?? null
        if (
          emisorNif &&
          invoice.status !== 'draft' &&
          invoice.full_number &&
          invoice.issue_date &&
          invoice.total != null
        ) {
          const qrUrl = buildQrUrl(
            {
              nif: emisorNif,
              invoiceNumber: invoice.full_number as string,
              issueDate: new Date(invoice.issue_date as string),
              total: invoice.total as number,
            },
            verifactuInvoiceConfigFromEnv(),
          )
          qrDataUrl = await buildQrDataUrl(qrUrl)
        }
      }
    } catch {
      // A QR rendering failure must never make a customer-facing invoice unavailable.
    }
  }

  // Redsys: determine if payment is available and how much has been paid
  const canPay =
    (invoice.status === 'issued' || invoice.status === 'overdue') && (invoice.total as number) > 0

  let amountPaid = 0
  if (canPay) {
    const { data: confirmedPayments } = await admin
      .from('invoice_payments')
      .select('id, amount, ds_authorisation_code, confirmed_at')
      .eq('invoice_id', invoice.id as string)
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false })
    amountPaid = confirmedPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0
  }
  const amountDue = Math.round(((invoice.total as number) - amountPaid) * 100) / 100

  const payments = canPay
    ? ((
        await admin
          .from('invoice_payments')
          .select('id, amount, ds_authorisation_code, confirmed_at')
          .eq('invoice_id', invoice.id as string)
          .eq('status', 'confirmed')
          .order('confirmed_at', { ascending: false })
      ).data ?? [])
    : []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      {success === '1' && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            ¡Pago realizado con éxito! La factura se marcará como pagada en breve.
          </p>
        </div>
      )}
      {paymentError === '1' && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          <XCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            El pago no se pudo completar. Por favor, inténtelo de nuevo o contacte con soporte.
          </p>
        </div>
      )}

      {payments.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Pagos recibidos
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatEUR(Number(p.amount))}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {p.confirmed_at ? formatDate(p.confirmed_at as string) : 'Confirmado'} · Aut:{' '}
                    {p.ds_authorisation_code ?? '—'}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/p/invoice/${token}/receipt/${p.id}`} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Justificante
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canPay && amountDue > 0 ? (
        <InvoicePaymentOptions
          invoiceId={invoice.id as string}
          token={token}
          total={invoice.total as number}
          amountPaid={amountPaid}
          invoiceNumber={invoice.full_number as string}
          companyName={(settings?.company_name as string | null) ?? null}
          iban={(settings?.iban as string | null) ?? null}
        />
      ) : null}

      <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
        {/* Document header */}
        <div className="flex flex-col gap-5 border-b border-zinc-200 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-7 dark:border-zinc-800">
          <div className="flex flex-col items-start gap-2">
            <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
              Factura · {invoice.invoice_type as string}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {invoice.full_number as string}
              </h1>
              <StatusBadge meta={INVOICE_STATUS} value={invoice.status as string} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {invoice.issue_date ? (
                <span>
                  Emitida:{' '}
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    {formatDate(invoice.issue_date as string)}
                  </strong>
                </span>
              ) : null}
              {invoice.due_date ? (
                <span>
                  Vencimiento:{' '}
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    {formatDate(invoice.due_date as string)}
                  </strong>
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end">
            <div className="sm:text-right">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total factura</p>
              <p className="text-xl font-bold text-zinc-900 tabular-nums dark:text-zinc-100">
                {formatEUR(Number(invoice.total ?? 0))}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`/p/invoice/${token}/pdf`}>
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
          </div>
        </div>

        {/* Issuer + Recipient */}
        <div className="grid border-b border-zinc-100 bg-zinc-50 sm:grid-cols-2 dark:border-zinc-800/60 dark:bg-zinc-900/50">
          {settings ? (
            <div className="border-b border-zinc-100 px-4 py-5 sm:border-r sm:border-b-0 sm:px-8 dark:border-zinc-800/60">
              <p className="mb-1 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                Emitida por
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {(settings.company_name as string | null) ?? '—'}
              </p>
              {(settings.company_nif as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  NIF: {settings.company_nif as string}
                </p>
              ) : null}
              {(settings.company_address as string | null) ? (
                <p className="text-xs whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
                  {settings.company_address as string}
                </p>
              ) : null}
              {(settings.iban as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  IBAN:{' '}
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {settings.iban as string}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="px-4 py-5 sm:px-8">
            <p className="mb-2 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
              Facturado a
            </p>
            <div className="mb-1 flex items-center gap-3">
              {client?.logo_url ? (
                // biome-ignore lint/performance/noImgElement: URL externa del logo del cliente, no compatible con next/image
                <img
                  src={client.logo_url}
                  alt={`Logo ${client.name}`}
                  className="size-8 rounded object-contain"
                />
              ) : null}
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {client?.name ?? '—'}
              </p>
            </div>
            {(invoice.client_nif as string | null) ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                NIF: {invoice.client_nif as string}
              </p>
            ) : null}
            {(invoice.client_address_street as string | null) ||
            (invoice.client_address_city as string | null) ? (
              <p className="text-xs whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
                {[
                  invoice.client_address_street,
                  [invoice.client_address_zip, invoice.client_address_city]
                    .filter(Boolean)
                    .join(' '),
                  invoice.client_address_province,
                  (invoice.client_address_country as string | null)?.toUpperCase() !== 'ES'
                    ? invoice.client_address_country
                    : null,
                ]
                  .filter(Boolean)
                  .join('\n')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-8 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Conceptos</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {safeItems.length} {safeItems.length === 1 ? 'concepto' : 'conceptos'}
          </span>
        </div>
        <InvoiceItemsSummary
          items={safeItems}
          subtotal={Number(invoice.subtotal ?? 0)}
          total={Number(invoice.total ?? 0)}
          vatBreakdown={vatBreakdown}
          variant="portal"
        />

        {/* Fiscal info + QR */}
        {invoice.verifactu_status === 'accepted' &&
        ((invoice.idfact as string | null) || (invoice.verifactu_csv as string | null) || qrDataUrl) ? (
          <div className="flex flex-col gap-4 border-t border-zinc-100 bg-zinc-50 px-8 py-5 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800/60 dark:bg-zinc-900/50">
            <div className="flex flex-col gap-1.5">
              <p className="mb-0.5 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                Datos fiscales
              </p>
              {(invoice.idfact as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  IDFACT:{' '}
                  <span className="font-mono break-all text-zinc-700 dark:text-zinc-300">
                    {invoice.idfact as string}
                  </span>
                </p>
              ) : null}
              {(invoice.verifactu_csv as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  CSV AEAT:{' '}
                  <span className="font-mono break-all text-zinc-700 dark:text-zinc-300">
                    {invoice.verifactu_csv as string}
                  </span>
                </p>
              ) : null}
            </div>
            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-1.5">
                <Image
                  src={qrDataUrl}
                  alt="QR Verifactu"
                  width={88}
                  height={88}
                  unoptimized
                  className="rounded"
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600">Verificar en AEAT</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Work log breakdown (only shown when logs are linked to this invoice) */}
        {workLogs && workLogs.length > 0 ? (
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="bg-zinc-50 px-8 py-5 dark:bg-zinc-900/50">
              <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                Desglose de actividad
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                    <th className="px-8 py-2.5 text-left text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                      Fecha
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                      Horario
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                      Horas
                    </th>
                    <th className="px-8 py-2.5 text-left text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                      Descripción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workLogs.map((log, i) => (
                    <tr
                      key={log.id as string}
                      className={i > 0 ? 'border-t border-zinc-100 dark:border-zinc-800/60' : ''}
                    >
                      <td className="px-8 py-3 whitespace-nowrap text-zinc-700 tabular-nums dark:text-zinc-300">
                        {formatDate(log.work_date as string)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                        {log.start_time && log.end_time
                          ? `${(log.start_time as string).slice(0, 5)} – ${(log.end_time as string).slice(0, 5)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-zinc-600 tabular-nums dark:text-zinc-400">
                        {Number(log.hours).toFixed(2)} h
                      </td>
                      <td className="px-8 py-3 text-zinc-600 dark:text-zinc-400">
                        {(log.note as string | null) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {qrDataUrl ? (
          <div className="border-t border-zinc-200 px-8 py-4 dark:border-zinc-800">
            <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Factura verificable en la sede electrónica de la AEAT mediante el código QR. Sistema de
              emisión conforme al Reglamento Verifactu (RD 1007/2023). Conserve esta factura conforme
              a la normativa fiscal aplicable.
            </p>
          </div>
        ) : null}
      </article>
    </div>
  )
}
