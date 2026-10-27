import { type NextRequest, NextResponse } from 'next/server'

import { loadNdaByToken } from '@/lib/nda/load'
import { renderNdaPdf } from '@/lib/nda/pdf'

export const dynamic = 'force-dynamic'

/** Public NDA PDF download. The unguessable token is the access control. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params
  const nda = await loadNdaByToken(token)
  if (!nda) return NextResponse.json({ error: 'Acuerdo no encontrado' }, { status: 404 })

  const pdf = await renderNdaPdf(
    nda.document,
    nda.signedAt && nda.signedName ? { name: nda.signedName, signedAt: nda.signedAt } : null,
  )
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="NDA-doscientos.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
