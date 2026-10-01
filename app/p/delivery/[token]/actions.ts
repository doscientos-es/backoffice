'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { scopedLogger } from '@/lib/logger'
import { activateProposalMaintenanceSubscription } from '@/lib/proposals/maintenance-subscription'
import { AcceptProposalSignature, ProposalPortalToken } from '@/lib/schemas/proposal'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('portal.delivery')

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Client signature of the delivery note. Marks the proposal as finished and
 * activates its maintenance subscription, if any. The linked project stays open.
 */
export async function signDeliveryNote(
  tokenInput: unknown,
  signatureInput: unknown,
): Promise<ActionResult> {
  const token = ProposalPortalToken.safeParse(tokenInput)
  if (!token.success) return { ok: false, error: 'Enlace no válido' }
  const signature = AcceptProposalSignature.safeParse(signatureInput)
  if (!signature.success) {
    return { ok: false, error: signature.error.errors[0]?.message ?? 'Firma no válida' }
  }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from('delivery_acceptances')
    .select('id, proposal_id, project_id, status')
    .eq('portal_token', token.data)
    .maybeSingle()
  if (!delivery) return { ok: false, error: 'Albarán no encontrado' }
  if (delivery.status !== 'sent' && delivery.status !== 'viewed') {
    return { ok: false, error: 'Este albarán ya no está disponible para su firma' }
  }

  const requestHeaders = await headers()
  const forwarded = requestHeaders.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? requestHeaders.get('x-real-ip') ?? ''
  const { data: deliveredAt, error: signError } = await admin.rpc('sign_delivery_acceptance', {
    p_delivery_acceptance_id: delivery.id,
    p_signer_name: signature.data.signer_name,
    p_signer_role: signature.data.signer_role ?? '',
    p_ip: ip,
    p_user_agent: requestHeaders.get('user-agent') ?? '',
  })
  if (signError || !deliveredAt) {
    log.warn({ err: signError, deliveryId: delivery.id }, 'delivery_note_sign_failed')
    return { ok: false, error: 'No se pudo registrar la firma del albarán' }
  }

  const proposalId = delivery.proposal_id as string
  const activation = await activateProposalMaintenanceSubscription(
    admin,
    proposalId,
    deliveredAt as string,
  )
  if (!activation.ok) {
    log.warn({ err: activation.error, proposalId }, 'delivery_subscription_activation_failed')
  }

  revalidatePath(`/p/delivery/${token.data}`)
  revalidatePath(`/proposals/${proposalId}`)
  revalidatePath('/proposals')
  revalidatePath('/subscriptions')
  if (delivery.project_id) revalidatePath(`/projects/${delivery.project_id}`)
  return { ok: true }
}
