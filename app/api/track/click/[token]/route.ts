import { type NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

const FALLBACK_URL = 'https://doscientos.es'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new NextResponse('Enlace no válido', { status: 404 })
  }

  // The real destination is passed as `?url=<encoded>` for existing emails.
  const rawUrl = req.nextUrl.searchParams.get('url')
  let destination = FALLBACK_URL
  if (rawUrl) {
    try {
      const url = new URL(rawUrl)
      if (url.protocol === 'http:' || url.protocol === 'https:') destination = url.toString()
    } catch {
      destination = FALLBACK_URL
    }
  }

  const supabase = createAdminClient()

  const { data } = await supabase
    .from('lead_campaign_sends')
    .select('id, clicked_at, click_count, lead_id, resend_email_id')
    .eq('tracking_token', token)
    .maybeSingle()

  if (!data) return new NextResponse('Enlace no válido', { status: 404 })

  const now = new Date().toISOString()
  await supabase
    .from('lead_campaign_sends')
    .update({
      clicked_at: data.clicked_at ?? now,
      click_count: (data.click_count ?? 0) + 1,
    })
    .eq('id', data.id)
  if (data.resend_email_id && rawUrl && destination !== FALLBACK_URL) {
    await supabase.from('lead_interactions').insert({
      lead_id: data.lead_id,
      type: 'email_clicked',
      subject: 'Enlace del email pulsado',
      resend_email_id: data.resend_email_id,
      payload: { source: 'tracking', click: { link: destination, timestamp: now } },
    })
  }

  return NextResponse.redirect(destination, { status: 302 })
}
