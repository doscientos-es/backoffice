import { sendEmail } from '@/lib/email/resend'
import { serverEnv } from '@/lib/env'

import { renderMarketingFooter } from './email-footer'
import { MARKETING_PRIVACY_URL } from './privacy-url'
import { renderMarketingMessage } from './render-message'

export async function sendMarketingTest(
  message: { subject: string; previewText?: string; bodyMarkdown: string },
  user: { name: string; email: string },
): Promise<void> {
  const env = serverEnv()
  const apiKey = env.EMAIL_MARKETING_RESEND_API_KEY || env.RESEND_API_KEY
  if (!apiKey) throw new Error('El envío de emails no está configurado.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))
    throw new Error('Tu perfil no tiene un email válido para recibir la prueba.')

  const rendered = renderMarketingMessage(message, {
    name: user.name,
    company: 'Empresa de ejemplo',
    email: user.email,
  })
  const result = await sendEmail({
    fromName: env.EMAIL_MARKETING_FROM_NAME,
    fromAlias: env.EMAIL_MARKETING_FROM_EMAIL,
    replyTo: env.EMAIL_MARKETING_REPLY_TO,
    apiKey,
    to: user.email,
    subject: `[Prueba] ${rendered.subject}`,
    html: `${rendered.html}${renderMarketingFooter('#baja-de-prueba', MARKETING_PRIVACY_URL)}<p style="font-size:12px;color:#6b7280">Email de prueba: el enlace de baja está desactivado.</p>`,
    tags: { email_marketing_test: 'true' },
  })
  if (result.mocked || !result.id) throw new Error('No se pudo enviar la prueba con Resend.')
}
