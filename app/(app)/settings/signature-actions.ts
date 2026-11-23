'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { HandwrittenSignatureSchema } from '@/lib/proposals/handwritten-signature'
import { createServerClient } from '@/lib/supabase/server'

export async function savePersonalSignature(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()
  const parsed = HandwrittenSignatureSchema.nullable().safeParse(input)
  if (!parsed.success) return { ok: false, error: 'La firma no es válida o es demasiado compleja.' }

  const supabase = await createServerClient()
  const { error } = parsed.data
    ? await supabase.from('team_member_signatures').upsert({
        member_id: user.id,
        signature: parsed.data,
        updated_at: new Date().toISOString(),
      })
    : await supabase.from('team_member_signatures').delete().eq('member_id', user.id)
  if (error) return { ok: false, error: 'No se pudo guardar la firma. Inténtalo de nuevo.' }

  revalidatePath('/settings/profile')
  return { ok: true }
}
