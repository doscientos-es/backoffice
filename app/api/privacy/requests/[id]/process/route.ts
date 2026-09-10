import { type NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { processPrivacyRequest } from '@/lib/privacy/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['owner'])
  } catch {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  }

  try {
    const result = await processPrivacyRequest(id, user)
    return NextResponse.json(result, { status: result.status === 'blocked' ? 409 : 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo procesar la solicitud' },
      { status: 500 },
    )
  }
}