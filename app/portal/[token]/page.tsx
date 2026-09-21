import { notFound, redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'

import ClientPortalLoginPage from '../login/page'

export default async function SharedClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('client_portal_access')
    .select('portal_token')
    .eq('portal_token', token)
    .eq('enabled', true)
    .maybeSingle()
  if (!data) notFound()
  if (user) redirect('/portal')
  return <ClientPortalLoginPage />
}
