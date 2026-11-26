import { type NextRequest, NextResponse } from 'next/server'

import { isGoogleEnabled, publicEnv, serverEnv } from '@/lib/env'
import { insertEvent } from '@/lib/google/calendar'
import { ingestLead } from '@/lib/integrations/lead-intake'
import {
  hasMenosliosAuthorization,
  menosliosBookingContext,
  menosliosIntake,
  menosliosPayload,
} from '@/lib/integrations/menoslios'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const env = serverEnv()
  if (!hasMenosliosAuthorization(request.headers.get('authorization'), env.MENOSLIOS_CRM_SECRET))
    return new NextResponse(null, { status: 401 })
  if (Number(request.headers.get('content-length')) > 8192)
    return new NextResponse(null, { status: 413 })
  const body = await request.text()
  if (body.length > 8192) return new NextResponse(null, { status: 413 })

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  const payload = menosliosPayload.safeParse(json)
  if (!payload.success) return new NextResponse(null, { status: 400 })
  const event = payload.data
  const result = await ingestLead(menosliosIntake(event))
  if (!result.ok) return new NextResponse(null, { status: 503 })
  if (event.kind === 'registration') return new NextResponse(null, { status: 204 })

  const db = createAdminClient()
  const subject = env.MENOSLIOS_CALENDAR_SUBJECT
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL
  if (
    !isGoogleEnabled() ||
    !subject ||
    !subject.endsWith(`@${env.GOOGLE_WORKSPACE_DOMAIN}`) ||
    !appUrl
  )
    return new NextResponse(null, { status: 503 })

  const context = menosliosBookingContext(event, result.leadId, appUrl)
  const [activity, promotion] = await Promise.all([
    db.from('lead_interactions').upsert(
      {
        id: context.interactionId,
        lead_id: result.leadId,
        type: 'note',
        subject: 'Menoslios: puesta en marcha reservada',
        body: context.note,
        payload: { source: 'menoslios', appointment_at: context.start.toISOString() },
      },
      { onConflict: 'id', ignoreDuplicates: true },
    ),
    db
      .from('leads')
      .update({ status: 'in_conversation' })
      .eq('id', result.leadId)
      .eq('status', 'new'),
  ])
  if (activity.error || promotion.error) return new NextResponse(null, { status: 503 })
  // Do not create a calendar entry for an appointment that has already happened.
  if (context.end <= new Date()) return new NextResponse(null, { status: 204 })

  try {
    await insertEvent({
      subject,
      calendarId: 'primary',
      start: context.start,
      end: context.end,
      summary: context.summary,
      description: context.description,
      idempotency: context.idempotency,
      privateContext: true,
      extendedProperties: { source: 'backoffice' },
    })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
  return new NextResponse(null, { status: 204 })
}
