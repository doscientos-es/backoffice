import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** MIME types the browser can preview inline; anything else falls back to download. */
const VIEWABLE_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain'])

/**
 * GET serves the stored file inline (no forced download), so the browser can
 * preview PDFs without leaving the app.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServerClient()
  const { data: doc, error } = await supabase
    .from('attachments')
    .select('id, storage_path, name, mime_type')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (!doc.storage_path) {
    return NextResponse.json({ error: 'Este documento no tiene archivo adjunto' }, { status: 400 })
  }

  if (!VIEWABLE_MIME_TYPES.has(doc.mime_type ?? '')) {
    return NextResponse.redirect(new URL(`/api/documents/${id}/download`, req.url))
  }

  const { data, error: downloadError } = await getStorage().download(
    'documents',
    doc.storage_path as string,
  )

  if (downloadError || !data) {
    return NextResponse.json(
      { error: 'No se pudo cargar el documento para su vista previa' },
      { status: 500 },
    )
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': doc.mime_type as string,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name as string)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
