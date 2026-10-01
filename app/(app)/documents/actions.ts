'use server'

import { z } from 'zod'

import { InternalDocumentEmail } from '@/components/email'
import { defineAction } from '@/lib/actions/define-action'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

const SendDocumentInput = z.object({
  id: z.string().uuid(),
  to: z.string().trim().email(),
  recipientName: z.string().trim().max(160).optional(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().max(2000).optional(),
})

const MAX_EMAIL_ATTACHMENT_BYTES = 40 * 1024 * 1024

export const sendDocumentEmail = defineAction({
  name: 'documents.sendEmail',
  schema: SendDocumentInput,
  roles: ['owner', 'admin', 'member'],
  handler: async ({ id, to, recipientName, subject, message }, { user }) => {
    const supabase = await createServerClient()
    const { data: document, error } = await supabase
      .from('attachments')
      .select('id, name, storage_path, mime_type, size_bytes')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error || !document || !document.storage_path) throw new Error('Documento no encontrado')
    if (document.size_bytes && Number(document.size_bytes) > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw new Error('El documento supera el límite de 40 MB para adjuntarlo por email.')
    }

    const { data, error: downloadError } = await getStorage().download(
      'documents',
      document.storage_path as string,
    )
    if (downloadError || !data) throw new Error(downloadError ?? 'No se pudo leer el documento')
    if (data.byteLength > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw new Error('El documento supera el límite de 40 MB para adjuntarlo por email.')
    }

    const result = await sendEmail({
      fromName: 'Backoffice doscientos',
      fromAlias: 'backoffice',
      replyTo: 'backoffice@doscientos.es',
      to,
      subject,
      html: await renderEmail(
        InternalDocumentEmail({
          documentName: String(document.name),
          recipientName: recipientName || undefined,
          message: message || undefined,
          appUrl: externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL),
        }),
      ),
      attachments: [
        {
          filename: String(document.name),
          content: Buffer.from(data),
        },
      ],
      tags: { attachment_id: id, kind: 'generated_document_email', sent_by: user.id },
    })

    await supabase.from('generated_documents').update({ status: 'sent' }).eq('attachment_id', id)

    return { mocked: result.mocked }
  },
})
