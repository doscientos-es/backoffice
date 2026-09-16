import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireRole } from '@/lib/auth'
import { inspectPdfTemplate } from '@/lib/document-templates/pdf'
import type { DocumentTemplateField } from '@/lib/document-templates/types'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const PdfInput = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  slug: z
    .string()
    .trim()
    .min(1, 'El identificador es obligatorio')
    .max(80)
    .regex(/^[a-z0-9_-]+$/, 'Usa minúsculas, números, guiones o guiones bajos'),
  description: z.string().trim().max(500).optional(),
})

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'template.pdf'
}

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const form = await request.formData()
  const parsed = PdfInput.safeParse({
    name: form.get('name')?.toString() ?? '',
    slug: form.get('slug')?.toString() ?? '',
    description: form.get('description')?.toString() ?? '',
  })
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Selecciona un PDF' }, { status: 400 })
  }
  if (
    file.size > MAX_SIZE_BYTES ||
    (file.type && file.type !== 'application/pdf') ||
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    return NextResponse.json(
      { error: 'La plantilla debe ser un PDF de máximo 10 MB' },
      { status: 400 },
    )
  }

  const bytes = await file.arrayBuffer()
  let fields: DocumentTemplateField[] = []
  try {
    fields = await inspectPdfTemplate(bytes)
  } catch {
    return NextResponse.json(
      { error: 'No se pudo leer el PDF. Usa un PDF con campos rellenables.' },
      { status: 400 },
    )
  }
  if (fields.length === 0) {
    return NextResponse.json(
      { error: 'El PDF no tiene campos rellenables. Añade campos AcroForm a la plantilla.' },
      { status: 400 },
    )
  }

  const id = crypto.randomUUID()
  const storagePath = `templates/${id}/${safeFilename(file.name)}`
  const storage = getStorage()
  const { error: uploadError } = await storage.upload('documents', storagePath, bytes, {
    contentType: 'application/pdf',
  })
  if (uploadError) return NextResponse.json({ error: uploadError }, { status: 500 })

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('document_templates')
    .insert({
      id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      size_bytes: file.size,
      fields,
      created_by: user.id,
    })
    .select('id, name, slug, fields')
    .single()

  if (error || !data) {
    await storage.remove('documents', [storagePath])
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo guardar la plantilla' },
      { status: 500 },
    )
  }

  return NextResponse.json({ id: data.id, fields: data.fields }, { status: 201 })
}
