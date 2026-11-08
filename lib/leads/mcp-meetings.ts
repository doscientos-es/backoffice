import { createHash } from 'node:crypto'

import { z } from 'zod'

import { isGoogleEnabled, serverEnv } from '@/lib/env'
import { insertEvent } from '@/lib/google/calendar'
import { resolveSubject } from '@/lib/google/client'
import { sanitizeLeadSharedText } from '@/lib/leads/shared-content'
import { createAdminClient } from '@/lib/supabase/admin'

export const McpMeetingInput = z
  .object({
    leadId: z.string().uuid(),
    kind: z.enum(['phone', 'meet']),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional(),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    idempotencyKey: z.string().uuid(),
    confirm: z.literal(true),
  })
  .strict()

type MeetingInput = z.infer<typeof McpMeetingInput>
const SALES_EMAIL = 'sales@doscientos.es'

function stableUuid(key: string, purpose: string): string {
  const hex = createHash('sha256')
    .update(`mcp-meeting:${purpose}:${key}`)
    .digest('hex')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`
}

export async function scheduleMcpMeeting(input: MeetingInput) {
  const start = new Date(input.start)
  const end = new Date(input.end)
  if (
    start.getTime() <= Date.now() ||
    end <= start ||
    end.getTime() - start.getTime() > 8 * 3600_000
  ) {
    throw new Error('La reunión debe ser futura y durar entre 1 minuto y 8 horas.')
  }
  if (end.getTime() - start.getTime() < 60_000)
    throw new Error('La reunión debe durar al menos 1 minuto.')
  if (!isGoogleEnabled() || !serverEnv().GOOGLE_CALENDAR_ID) {
    throw new Error('Google Calendar no está configurado en el backoffice.')
  }
  const db = createAdminClient()
  const { data: lead, error } = await db
    .from('leads')
    .select('id, name, alias, company, email, phone, assigned_to')
    .eq('id', input.leadId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !lead) throw new Error('No se ha encontrado el lead.')
  const email = z.string().trim().email().safeParse(lead.email)
  if (!email.success)
    throw new Error('El lead necesita un correo válido para recibir la invitación.')
  if (input.kind === 'phone' && !String(lead.phone ?? '').trim()) {
    throw new Error('El lead necesita un teléfono para agendar una llamada.')
  }
  const title = sanitizeLeadSharedText(input.title, lead)
  const sharedDescription = input.description
    ? sanitizeLeadSharedText(input.description, lead)
    : undefined
  const description =
    input.kind === 'phone'
      ? [`Reunión telefónica. Teléfono: ${String(lead.phone).trim()}`, sharedDescription]
          .filter(Boolean)
          .join('\n\n')
      : sharedDescription
  const attendees = [...new Set([SALES_EMAIL, email.data.toLowerCase()])]
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        leadId: input.leadId,
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        start: start.toISOString(),
        end: end.toISOString(),
        attendees,
        phone: input.kind === 'phone' ? lead.phone : null,
        sharedTitle: title,
        sharedDescription: description,
      }),
    )
    .digest('hex')
  const subject = resolveSubject()
  const event = await insertEvent({
    subject,
    calendarId: serverEnv().GOOGLE_CALENDAR_ID!,
    summary: title,
    description,
    start,
    end,
    attendees,
    withMeet: input.kind === 'meet',
    sendUpdates: 'all',
    idempotency: {
      eventId: `mcp${input.idempotencyKey.replaceAll('-', '').toLowerCase()}`,
      fingerprint,
    },
  })

  // Deterministic IDs make retrying a partially completed operation safe. Never
  // overwrite a reminder or interaction that somebody has since edited.
  // Meet links may be generated asynchronously. Do not persist a permanently
  // empty URL: the CRM artifact importer only processes meetings with a URL.
  const meetLinkPending = input.kind === 'meet' && !event.meetUrl
  const interactionResult = meetLinkPending
    ? null
    : await db.from('lead_interactions').upsert(
        {
          id: stableUuid(input.idempotencyKey, 'interaction'),
          lead_id: input.leadId,
          type: 'meeting',
          subject: title,
          body: description ?? null,
          performed_by: lead.assigned_to ?? null,
          payload: {
            calendar_event_id: event.id,
            calendar_html_link: event.htmlLink,
            meet_url: event.meetUrl,
            organizer_email: subject,
            start: start.toISOString(),
            end: end.toISOString(),
            attendees,
            meeting_kind: input.kind,
          },
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
  const { error: reminderError } = await db.from('tasks').upsert(
    {
      id: stableUuid(input.idempotencyKey, 'reminder'),
      kind: 'reminder',
      action_type: input.kind === 'phone' ? 'call' : 'meeting',
      title,
      description: description ?? null,
      start_at: start.toISOString(),
      lead_id: input.leadId,
      created_by: lead.assigned_to ?? null,
      assignee_id: lead.assigned_to ?? null,
      status: 'todo',
      priority: 'medium',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )

  return {
    eventId: event.id,
    calendarUrl: event.htmlLink,
    meetUrl: event.meetUrl,
    kind: input.kind,
    start: start.toISOString(),
    end: end.toISOString(),
    attendees,
    meetLinkPending,
    invitation: 'Se ha solicitado a Google Calendar el envío de las invitaciones.',
    emailReminder:
      'Los recordatorios posteriores dependen de la configuración del calendario del invitado.',
    crmRecorded: Boolean(interactionResult && !interactionResult.error),
    internalReminderCreated: !reminderError,
    retryWithSameKey: Boolean(meetLinkPending || interactionResult?.error || reminderError),
  }
}
