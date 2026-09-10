import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireRole } from '@/lib/auth'
import { withdrawMarketingConsent } from '@/lib/privacy/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({ leadId: z.string().uuid(), source: z.string().trim().min(1).max(100) })

export async function POST(request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })

  try {
    await withdrawMarketingConsent(parsed.data.leadId, user, parsed.data.source)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo retirar el consentimiento' },
      { status: 500 },
    )
  }
}