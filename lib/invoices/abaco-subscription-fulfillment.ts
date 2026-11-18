import 'server-only'
import { InvoiceEmail } from '@/components/email'
import { validateAndRecordClientFiscalIdentity } from '@/lib/clients/fiscal-verification'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv, serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatEUR } from '@/lib/utils'
import { verifactuSoftwareSnapshotFromEnv } from '@/lib/verifactu/config'
import { assertDurableVerifactuPackage } from '@/lib/verifactu/outbox'

import type { AbacoSubscriptionPayment } from './abaco-subscription-event'

export async function prepareAbacoSubscription(
  tenantId: string,
  recipient: AbacoSubscriptionPayment['recipient'],
): Promise<string> {
  await assertDurableVerifactuPackage()
  verifactuSoftwareSnapshotFromEnv()
  if (!serverEnv().RESEND_API_KEY) return 'unavailable'
  const { data, error } = await createAdminClient().rpc('prepare_abaco_billing_account', {
    p_tenant: tenantId,
    p_recipient: recipient,
  })
  if (error || !data?.status) throw new Error('No se pudo preparar el destinatario de Ábaco')
  if (data.status !== 'fiscal_verification_required') return data.status

  const result = await validateAndRecordClientFiscalIdentity(data.clientId, null)
  if (result.status === 'verified') return 'ready'
  return result.status === 'unavailable' ? 'unavailable' : 'fiscal_identity_invalid'
}

export async function fulfillAbacoSubscription(payment: AbacoSubscriptionPayment) {
  await assertDurableVerifactuPackage()
  const admin = createAdminClient()
  const { data: id, error } = await admin.rpc('issue_abaco_subscription_invoice', {
    p_event: payment,
    p_software: verifactuSoftwareSnapshotFromEnv(),
  })
  if (error || !id) throw new Error('No se pudo emitir la factura de Ábaco')

  const { data: invoice, error: readError } = await admin
    .from('invoices')
    .select('full_number, portal_token, status, is_client_visible')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (readError) throw new Error('No se pudo consultar la factura de Ábaco')
  if (
    !invoice?.full_number ||
    !invoice.portal_token ||
    invoice.status !== 'paid' ||
    !invoice.is_client_visible
  ) {
    return { status: 'invoice_review' }
  }
  const { data: state, error: stateError } = await admin.rpc('begin_abaco_invoice_email', {
    p_payment: payment.paymentId,
  })
  if (stateError) throw new Error('No se pudo consultar el envío de Ábaco')
  if (state === 'fiscal_pending' || state === 'fiscal_review') return { status: state }

  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  const portalUrl = `${appUrl}/p/invoice/${encodeURIComponent(invoice.portal_token)}?lang=es`
  const details = { invoiceNumber: invoice.full_number as string, portalUrl }
  if (state === 'sent') return { status: 'sent', ...details }
  if (state === 'review') return { status: 'email_review', ...details }
  if (state !== 'send') throw new Error('Estado de envío de Ábaco no reconocido')

  try {
    const html = await renderEmail(
      InvoiceEmail({
        clientName: payment.recipient.legal_name,
        invoiceNumber: details.invoiceNumber,
        total: formatEUR(payment.totalCents / 100),
        dueDate: formatDate(payment.paidAt),
        portalUrl,
        appUrl,
        language: 'es',
      }),
    )
    const result = await sendEmail({
      fromName: 'Doscientos',
      fromAlias: 'facturacion',
      to: payment.recipient.email,
      subject: `Factura ${details.invoiceNumber}`,
      html,
      idempotencyKey: `abaco-subscription/${payment.paymentId}`,
    })
    if (result.mocked || !result.id) throw new Error('Resend no confirmó el envío')
    const { error: finishError } = await admin.rpc('finish_abaco_invoice_email', {
      p_payment: payment.paymentId,
      p_provider_id: result.id,
    })
    if (finishError) throw new Error('No se pudo registrar el envío')
    return { status: 'sent', ...details }
  } catch {
    return { status: 'email_pending', ...details }
  }
}
