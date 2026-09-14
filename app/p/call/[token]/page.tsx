import { notFound } from 'next/navigation'

import { isCallSessionStatus } from '@/lib/leads/call-session'
import { createAdminClient } from '@/lib/supabase/admin'

import { MobileCallSession } from './mobile-call-session'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Llamada · doscientos',
  robots: { index: false, follow: false },
}

export default async function MobileCallPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    notFound()
  }
  const { data: session } = await createAdminClient()
    .from('lead_call_sessions')
    .select('status, expires_at, leads(phone)')
    .eq('mobile_token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  const lead = Array.isArray(session?.leads) ? session.leads[0] : session?.leads
  const phone = lead?.phone
  if (!phone || !session || !isCallSessionStatus(session.status)) notFound()

  return <MobileCallSession token={token} phone={phone as string} status={session.status} />
}