import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

type Context = { params: Promise<{ token: string }> }

async function unsubscribe(token: string): Promise<'ok' | 'invalid' | 'error'> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))
    return 'invalid'
  try {
    const supabase = createAdminClient()
    const { data: direct, error: contactError } = await supabase
      .from('email_marketing_contacts')
      .select('id')
      .eq('unsubscribe_token', token)
      .maybeSingle()
    if (contactError) return 'error'
    let contactId = direct?.id as string | undefined
    let sendId: string | undefined
    if (!contactId) {
      const { data: send, error: sendError } = await supabase
        .from('lead_campaign_sends')
        .select('id, email')
        .eq('tracking_token', token)
        .maybeSingle()
      if (sendError) return 'error'
      if (!send?.email) return 'invalid'
      sendId = send.id as string
      const email = (send.email as string).trim().toLowerCase()
      const findContact = () =>
        supabase
          .from('email_marketing_contacts')
          .select('id')
          .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
          .maybeSingle()
      const { data: existing, error: lookupError } = await findContact()
      if (lookupError) return 'error'
      contactId = existing?.id as string | undefined
      if (!contactId) {
        const { data: created, error: insertError } = await supabase
          .from('email_marketing_contacts')
          .insert({ email, status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
          .select('id')
          .maybeSingle()
        if (insertError && insertError.code !== '23505') return 'error'
        if (insertError) {
          const { data: raced, error: racedError } = await findContact()
          if (racedError) return 'error'
          contactId = raced?.id as string | undefined
        } else contactId = created?.id as string | undefined
      }
    }
    if (!contactId) return 'error'
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('email_marketing_contacts')
      .update({ status: 'unsubscribed', unsubscribed_at: now })
      .eq('id', contactId)
      .select('id')
      .maybeSingle()
    if (updateError || !updated) return 'error'
    if (sendId) {
      const { error } = await supabase
        .from('lead_campaign_sends')
        .update({ unsubscribed_at: now })
        .eq('id', sendId)
      if (error) return 'error'
    }
    return 'ok'
  } catch {
    return 'error'
  }
}

async function handle(context: Context, oneClick: boolean) {
  const { token } = await context.params
  const result = await unsubscribe(token)
  const status = result === 'ok' ? 200 : result === 'invalid' ? 404 : 503
  const title =
    result === 'ok'
      ? 'Baja confirmada'
      : result === 'invalid'
        ? 'Enlace no válido'
        : 'No se ha podido registrar la baja'
  const message =
    result === 'ok'
      ? 'Tu dirección ha quedado excluida de los emails comerciales de doscientos.'
      : result === 'invalid'
        ? 'Este enlace no es válido. Contacta con nosotros para solicitar la baja.'
        : 'Por favor, vuelve a intentarlo o contacta con nosotros para solicitar la baja.'
  return new NextResponse(
    oneClick && result === 'ok'
      ? null
      : `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f7f5;color:#111}main{max-width:520px;padding:32px}p{color:#555;line-height:1.5}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  )
}

export async function GET(_request: Request, context: Context) {
  return handle(context, false)
}
export async function POST(_request: Request, context: Context) {
  return handle(context, true)
}
