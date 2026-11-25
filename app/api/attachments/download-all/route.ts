import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { createZip } from '@/lib/exports/quarterly-invoices'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_TOTAL_BYTES = 200 * 1024 * 1024
const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })

function uniqueFilename(name: string, used: Set<string>): string {
  const safe =
    Array.from(name, (char) => (char.charCodeAt(0) < 32 ? '_' : char))
      .join('')
      .replace(/[\\/<>:"|?*]/g, '_')
      .replace(/^\.+|[. ]+$/g, '')
      .slice(0, 200) || 'adjunto'
  const extensionIndex = safe.lastIndexOf('.')
  const base = extensionIndex > 0 ? safe.slice(0, extensionIndex) : safe
  const extension = extensionIndex > 0 ? safe.slice(extensionIndex) : ''
  let candidate = safe
  let suffix = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${suffix++})${extension}`
  }
  used.add(candidate.toLowerCase())
  return candidate
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let ids: string[]
  try {
    ids = [...new Set(bodySchema.parse(await req.json()).ids)]
  } catch {
    return NextResponse.json(
      { error: 'Selecciona entre 1 y 100 adjuntos válidos' },
      { status: 400 },
    )
  }

  try {
    const supabase = await createServerClient()
    const { data: attachments, error } = await supabase
      .from('attachments')
      .select('id, name, storage_path, size_bytes, source')
      .in('id', ids)
      .is('deleted_at', null)

    if (error)
      return NextResponse.json({ error: 'No se pudieron cargar los adjuntos' }, { status: 500 })
    if (
      !attachments ||
      attachments.length !== ids.length ||
      attachments.some((item) => !item.storage_path || item.source === 'drive')
    ) {
      return NextResponse.json({ error: 'Algún adjunto no está disponible' }, { status: 404 })
    }
    if (attachments.reduce((sum, item) => sum + (item.size_bytes ?? 0), 0) > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: 'Los adjuntos superan el límite de 200 MB' },
        { status: 413 },
      )
    }

    const storage = getStorage()
    const usedNames = new Set<string>()
    const entries: { name: string; body: Uint8Array }[] = []
    let totalBytes = 0
    for (const item of attachments) {
      const { data, error: downloadError } = await storage.download(
        'documents',
        item.storage_path as string,
      )
      if (downloadError || !data) {
        return NextResponse.json({ error: `No se pudo descargar ${item.name}` }, { status: 500 })
      }
      totalBytes += data.byteLength
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: 'Los adjuntos superan el límite de 200 MB' },
          { status: 413 },
        )
      }
      entries.push({ name: uniqueFilename(item.name, usedNames), body: new Uint8Array(data) })
    }

    return new NextResponse(new Uint8Array(createZip(entries)), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="adjuntos.zip"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudieron descargar los adjuntos' }, { status: 500 })
  }
}
