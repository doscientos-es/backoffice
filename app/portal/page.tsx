import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'

export default async function ClientPortalPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/portal/login')

  const { data: access } = await supabase.from('client_portal_access').select('client_id').eq('user_id', user.id).eq('enabled', true).maybeSingle()
  if (!access) return <main className="mx-auto max-w-2xl px-6 py-20"><h1 className="text-2xl font-semibold">Acceso pendiente</h1><p className="mt-3 text-muted-foreground">Este email todavía no tiene un portal de cliente habilitado.</p></main>

  const [{ data: proposals }, { data: invoices }, { data: projects }] = await Promise.all([
    supabase.from('proposals').select('id, number, title, status, portal_token, total, sent_at').eq('client_id', access.client_id).neq('status', 'draft').order('sent_at', { ascending: false }),
    supabase.from('invoices').select('id, full_number, status, portal_token, total, issue_date').eq('client_id', access.client_id).neq('status', 'draft').order('issue_date', { ascending: false }),
    supabase.from('projects').select('id, name, status, portal_token').eq('client_id', access.client_id).is('deleted_at', null).order('created_at', { ascending: false }),
  ])

  return <main className="mx-auto max-w-5xl px-6 py-12"><p className="text-sm text-muted-foreground">Área de cliente</p><h1 className="mt-2 text-3xl font-semibold">Hola</h1><p className="mt-2 text-muted-foreground">Aquí tienes tus propuestas, facturas y proyectos.</p><div className="mt-10 grid gap-6 md:grid-cols-3">{[
    ['Propuestas', proposals ?? [], (item: any) => `/p/proposal/${item.portal_token}`, (item: any) => `${item.number} · ${item.title}`],
    ['Facturas', invoices ?? [], (item: any) => `/p/invoice/${item.portal_token}`, (item: any) => item.full_number],
    ['Proyectos', (projects ?? []).filter((item: any) => item.portal_token), (item: any) => `/p/project/${item.portal_token}`, (item: any) => item.name],
  ].map(([title, items, href, label]: any) => <section key={title} className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">{title}</h2><div className="mt-4 space-y-2">{items.length ? items.map((item: any) => <Link key={item.id} href={href(item)} className="block rounded-xl border px-3 py-3 text-sm hover:bg-muted">{label(item)}<span className="mt-1 block text-xs text-muted-foreground">{item.status}</span></Link>) : <p className="text-sm text-muted-foreground">Todavía no hay documentos visibles.</p>}</div></section>)}</div></main>
}
