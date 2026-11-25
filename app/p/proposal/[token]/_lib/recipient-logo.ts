import type { createAdminClient } from '@/lib/supabase/admin'

/** During the transition, lead-first proposals can use their linked client's logo. */
export async function resolveRecipientLogo(
  admin: ReturnType<typeof createAdminClient>,
  clientLogo: string | null,
  leadId: string | null,
): Promise<string | null> {
  if (clientLogo || !leadId) return clientLogo
  const { data, error } = await admin
    .from('clients')
    .select('logo_url')
    .eq('lead_id', leadId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return null
  return (data?.logo_url as string | null) ?? null
}
