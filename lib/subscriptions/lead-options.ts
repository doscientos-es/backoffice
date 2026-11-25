import type { createServerClient } from '@/lib/supabase/server'

export async function getBillableLeadOptions(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
) {
  const { data, error } = await supabase
    .from('clients')
    .select('lead_id, name, leads(name, deleted_at)')
    .is('deleted_at', null)
  if (error) throw new Error('No se pudieron cargar los leads con datos de facturación')

  // Finance can read billing records even when it has no CRM access.
  const rows = (data ?? []) as unknown as {
    lead_id: string
    name: string
    leads: { name: string; deleted_at: string | null } | null
  }[]
  return rows
    .filter(({ leads }) => !leads?.deleted_at)
    .map(({ lead_id, name, leads }) => ({ id: lead_id, name: leads?.name ?? name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
