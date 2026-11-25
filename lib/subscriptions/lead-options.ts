import type { createServerClient } from '@/lib/supabase/server'

export async function getBillableLeadOptions(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
) {
  const { data, error } = await supabase
    .from('clients')
    .select('leads!inner(id, name)')
    .is('deleted_at', null)
    .is('leads.deleted_at', null)
  if (error) throw new Error('No se pudieron cargar los leads con datos de facturación')

  const rows = (data ?? []) as unknown as { leads: { id: string; name: string } }[]
  return rows.map(({ leads }) => leads).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
