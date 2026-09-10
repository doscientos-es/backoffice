import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireRole } from '@/lib/auth'
import { PRIVACY_SUBJECT_TYPES, createPrivacyRequest } from '@/lib/privacy/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const requestSchema = z.object({
  subjectType: z.enum(PRIVACY_SUBJECT_TYPES),
  subjectId: z.string().uuid(),
  requesterEmail: z.string().email().optional(),
  requestType: z.enum(['access', 'erasure']),
  identityVerified: z.boolean(),
  scheduledFor: z.string().datetime().optional(),
  internalNotes: z.string().max(2_000).optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['owner'])
  } catch {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })

  try {
    const created = await createPrivacyRequest(parsed.data, user)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo crear la solicitud' },
      { status: 500 },
    )
  }
}