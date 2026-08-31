import { validateSpanishFiscalIdentity } from '@/lib/aeat/nif-validation'
import type { FiscalVerificationStatus } from '@/lib/clients/types'
import { assertExternalActionAllowed } from '@/lib/demo'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifactuInvoiceConfigFromEnv } from '@/lib/verifactu/config'
import { validateNifEs } from '@/lib/vies/nif'

type Result = {
  status: Exclude<FiscalVerificationStatus, 'unverified'>
  aeatName: string | null
  message: string
}

export async function validateAndRecordClientFiscalIdentity(
  clientId: string,
  checkedBy: string,
): Promise<Result> {
  const admin = createAdminClient()
  const { data: client, error } = await admin
    .from('clients')
    .select('id, nif, name, billing_address_country')
    .eq('id', clientId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !client) throw new Error(error?.message ?? 'Cliente no encontrado')

  const submittedNif = String(client.nif ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')
  const aeatNif = submittedNif.startsWith('ES') ? submittedNif.slice(2) : submittedNif
  const name = String(client.name ?? '').trim()
  const country = String(client.billing_address_country ?? 'ES')
    .trim()
    .toUpperCase()
  let status: Result['status']
  let aeatName: string | null = null
  let aeatResult: string | null = null
  let message: string

  if (country !== 'ES') {
    status = 'not_applicable'
    message = 'La comprobación VNifV2 solo cubre destinatarios españoles.'
  } else if (!submittedNif || !name) {
    status = 'invalid'
    message = 'Introduce NIF y razón social antes de validar.'
  } else {
    const local = validateNifEs(aeatNif)
    if (!local.valid) {
      status = 'invalid'
      message = local.message
    } else {
      assertExternalActionAllowed('La validación censal con AEAT')
      const result = await validateSpanishFiscalIdentity(
        { nif: aeatNif, name },
        verifactuInvoiceConfigFromEnv().certificate,
      )
      status = result.status
      aeatName = result.aeatName
      aeatResult = result.aeatResult
      message = result.message
    }
  }

  const { error: recordError } = await admin.rpc('record_client_fiscal_verification', {
    p_client_id: clientId,
    p_submitted_nif: aeatNif,
    p_submitted_name: name,
    p_status: status,
    p_aeat_name: aeatName,
    p_aeat_result: aeatResult,
    p_detail: message,
    p_checked_by: checkedBy,
  })
  if (recordError) throw new Error(recordError.message)
  return { status, aeatName, message }
}

export async function ensureInvoiceRecipientVerified(invoiceId: string, checkedBy: string) {
  const admin = createAdminClient()
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('invoice_type, client_id')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !invoice) throw new Error(error?.message ?? 'Factura no encontrada')
  if (invoice.invoice_type !== 'F1') return
  if (!invoice.client_id) throw new Error('La factura F1 no tiene destinatario fiscal')

  const result = await validateAndRecordClientFiscalIdentity(invoice.client_id, checkedBy)
  if (result.status !== 'verified') {
    throw new Error(`No se ha podido validar el destinatario con AEAT: ${result.message}`)
  }
}
