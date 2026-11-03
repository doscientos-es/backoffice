import { NewLeadEmail } from '@/components/email/new-lead-email'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

export type NotifyNewLeadInput = {
  leadId: string
  leadName: string
  leadEmail?: string | null
  leadPhone?: string | null
  leadCompany?: string | null
  leadSource: string
}

const log = scopedLogger('notify-new-lead')

const SALES_EMAIL = 'sales@doscientos.es'

/**
 * Notifies the team when a new lead is created.
 *
 * - Inserts an in-app `notifications` row (event_type: "lead_new") for each active
 *   member with leads enabled so the bell icon lights up via Supabase Realtime.
 * - Emails those members directly, plus the shared sales@doscientos.es mailbox.
 *
 * Errors inside this function are logged but never propagate — callers should
 * invoke with `.catch(() => {})` so lead creation is never blocked.
 */
export async function notifyNewLead(input: NotifyNewLeadInput): Promise<void> {
  const supabase = createAdminClient()
  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
  const leadUrl = `${appUrl}/leads/${input.leadId}`

  // ── 1. Fetch active members with “Leads: sí” in team settings ─────────────
  const { data: members, error: fetchError } = await supabase
    .from('team_members')
    .select('id, email')
    .eq('leads_assignable', true)
    .is('deleted_at', null)

  if (fetchError) {
    log.error({ err: fetchError }, 'failed to fetch lead notification recipients')
  }
  const recipients = fetchError ? [] : (members ?? [])
  if (!recipients.length) {
    log.warn('no active members with leads enabled to notify for lead_new')
  }

  // Short summary line used as the in-app notification body
  const notifBody = [input.leadName, input.leadCompany, input.leadEmail, input.leadPhone]
    .filter(Boolean)
    .join(' · ')
  const phoneDigits = input.leadPhone?.replace(/\D/g, '') ?? ''
  const callUrl = phoneDigits ? `tel:${phoneDigits}` : null
  const whatsappUrl = phoneDigits ? `https://wa.me/${phoneDigits}` : null
  const notificationActions = [{ action: 'feedback', title: 'Registrar' }]
  if (input.leadPhone) {
    notificationActions.unshift(
      { action: 'call', title: 'Llamar' },
      { action: 'whatsapp', title: 'WhatsApp' },
    )
  }

  // ── 2. In-app notification + background Push ─────────────────────────────
  await dispatchNotifications({
    recipientIds: recipients.map((r) => r.id as string),
    eventType: 'lead_new',
    entityType: 'lead',
    entityId: input.leadId,
    body: notifBody || 'Ha entrado un nuevo lead',
    link: `/leads/${input.leadId}`,
    actions: notificationActions,
    data: {
      callUrl,
      whatsappUrl,
      feedbackUrl: `/leads/${input.leadId}?feedback=call`,
    },
  }).catch((e) => {
    log.error({ err: e, leadId: input.leadId }, 'lead_new in-app/push notification failed')
  })

  // ── 3. Email (render once, send to all) ──────────────────────────────────
  let html: string
  try {
    html = await renderEmail(
      NewLeadEmail({
        leadName: input.leadName,
        leadEmail: input.leadEmail ?? null,
        leadPhone: input.leadPhone ?? null,
        leadCompany: input.leadCompany ?? null,
        leadSource: input.leadSource,
        leadUrl,
        appUrl,
      }),
    )
  } catch (e) {
    log.error({ err: e }, 'failed to render NewLeadEmail')
    return
  }

  const subject = `Nuevo lead: ${input.leadName}${input.leadCompany ? ` · ${input.leadCompany}` : ''}`

  // Send separately so delivery does not depend on sales mailbox forwarding.
  const emailRecipients = [
    ...new Set([
      SALES_EMAIL,
      ...recipients
        .map((r) => r.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ]),
  ]
  const results = await Promise.allSettled(
    emailRecipients.map((to) =>
      sendEmail({
        fromName: 'doscientos',
        fromAlias: 'notificaciones',
        to,
        subject,
        html,
        tags: { lead_id: input.leadId },
      }),
    ),
  )
  const emailFailedCount = results.filter((result) => result.status === 'rejected').length
  for (const result of results) {
    if (result.status === 'rejected') {
      log.error({ err: result.reason, leadId: input.leadId }, 'lead_new email failed to send')
    }
  }

  log.info(
    { leadId: input.leadId, recipientCount: recipients.length, emailFailedCount },
    'lead_new notifications dispatched',
  )
}
