import type { createServerClient } from '@/lib/supabase/server'

/** Fail closed when the recipient's marketing status cannot be checked. */
export async function assertMarketingEmailAllowed(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  email: string,
) {
  const normalized = email
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, '\\$&')
  const { data, error } = await supabase
    .from('email_marketing_contacts')
    .select('status')
    .ilike('email', normalized)
    .maybeSingle()
  if (error) throw new Error('No se pudo comprobar la baja del destinatario.')
  if (data && data.status !== 'subscribed')
    throw new Error('Este destinatario está dado de baja o bloqueado para emails comerciales.')
}
