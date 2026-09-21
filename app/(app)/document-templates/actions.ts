'use server'

import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { missingRequiredFields } from '@/lib/document-templates/fields'
import { fillPdfTemplate } from '@/lib/document-templates/pdf'
import type { DocumentTemplateField } from '@/lib/document-templates/types'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

const GenerateDocumentInput = z.object({
  templateId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  values: z.record(z.union([z.string(), z.boolean()])).default({}),
})

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'documento'
}

export const generateDocument = defineAction<
  typeof GenerateDocumentInput,
  { attachmentId: string }
>({
  name: 'documentTemplates.generate',
  schema: GenerateDocumentInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: (_payload, input) => [
    '/settings/document-templates',
    ...(input.leadId ? [`/leads/${input.leadId}`] : []),
    ...(input.clientId ? [`/clients/${input.clientId}`] : []),
    ...(input.projectId ? [`/projects/${input.projectId}`] : []),
  ],
  handler: async ({ templateId, leadId, clientId, projectId, values }, { user }) => {
    const supabase = await createServerClient()
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('id, name, storage_path, fields, version, is_active')
      .eq('id', templateId)
      .is('deleted_at', null)
      .maybeSingle()
    if (templateError || !template || !template.is_active)
      throw new Error('Documento genérico no disponible')

    const fields = (
      Array.isArray(template.fields) ? template.fields : []
    ) as DocumentTemplateField[]
    const missing = missingRequiredFields(fields, values)
    if (missing.length > 0) {
      throw new Error(
        `Faltan campos obligatorios: ${missing.map((field) => field.label).join(', ')}`,
      )
    }

    const { data: original, error: downloadError } = await getStorage().download(
      'documents',
      template.storage_path as string,
    )
    if (downloadError || !original) throw new Error('No se pudo leer el documento genérico')

    const pdf = await fillPdfTemplate({ bytes: original, fields, values })
    const attachmentId = crypto.randomUUID()
    const filename = `${safeFilename(String(template.name))}-${attachmentId}.pdf`
    const storagePath = `generated/${clientId ?? projectId ?? leadId ?? 'misc'}/${attachmentId}/${filename}`
    const storage = getStorage()
    const pdfBytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer
    const { error: uploadError } = await storage.upload('documents', storagePath, pdfBytes, {
      contentType: 'application/pdf',
    })
    if (uploadError) throw new Error(uploadError)

    const { error: attachmentError } = await supabase.from('attachments').insert({
      id: attachmentId,
      name: `${template.name}.pdf`,
      mime_type: 'application/pdf',
      size_bytes: pdf.byteLength,
      storage_path: storagePath,
      client_id: clientId ?? null,
      project_id: projectId ?? null,
      lead_id: leadId ?? null,
      uploaded_by: user.id,
    })
    if (attachmentError) {
      await storage.remove('documents', [storagePath])
      throw new Error(attachmentError.message)
    }

    const { error: generatedError } = await supabase.from('generated_documents').insert({
      template_id: template.id,
      template_version: template.version,
      attachment_id: attachmentId,
      client_id: clientId ?? null,
      project_id: projectId ?? null,
      values,
      created_by: user.id,
    })
    if (generatedError) {
      await storage.remove('documents', [storagePath])
      await supabase.from('attachments').delete().eq('id', attachmentId)
      throw new Error(generatedError.message)
    }

    return { attachmentId }
  },
})
