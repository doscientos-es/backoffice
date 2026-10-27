'use server'

import { createHash } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

import { distributedRateLimit } from '@/lib/ratelimit'
import { PortalToken } from '@/lib/schemas/portal'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { ok: true } | { ok: false; error: string }

const SignNdaInput = z.object({
  token: PortalToken,
  name: z.string().trim().min(3, 'Escribe tu nombre completo').max(120),
  accept: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar el acuerdo' }) }),
})

/** Public: the counterparty accepts the NDA by typing their name. */
export async function signNda(input: unknown): Promise<ActionResult> {
  const parsed = SignNdaInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  }
  const { token, name } = parsed.data

  const requestHeaders = await headers()
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const tokenKey = createHash('sha256').update(token).digest('hex').slice(0, 16)
  const limit = await distributedRateLimit(`nda-sign:${tokenKey}:${ip}`, 5, 600)
  if (!limit.success) return { ok: false, error: 'Demasiados intentos. Inténtalo más tarde.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_ndas')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signed_name: name,
      signed_ip: ip,
    })
    .eq('portal_token', token)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .select('id, lead_id')
    .maybeSingle()
  if (error) return { ok: false, error: 'No se pudo registrar la firma' }
  if (!data) return { ok: false, error: 'Este acuerdo ya está firmado o no está disponible' }

  revalidatePath(`/p/nda/${token}`)
  revalidatePath(`/leads/${data.lead_id as string}/nda`)
  return { ok: true }
}
