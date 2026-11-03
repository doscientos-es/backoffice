import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { interactionBodyText } from '@/lib/leads/interaction-utils'
import { can } from '@/lib/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Stable source URL, including interactions older than the detail page's 50-row window. */
export default async function LeadHistorySource({
  params,
}: {
  params: Promise<{ id: string; interactionId: string }>
}) {
  const user = await requireUser()
  if (!can(user.role, 'leads.read')) notFound()
  const { id, interactionId } = await params
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(interactionId).success
  )
    notFound()
  const db = await createServerClient()
  const [leadResult, interactionResult] = await Promise.all([
    db.from('leads').select('id, name').eq('id', id).is('deleted_at', null).maybeSingle(),
    db
      .from('lead_interactions')
      .select('id, type, subject, body, created_at, summary:payload->meet_artifacts->>summary')
      .eq('id', interactionId)
      .eq('lead_id', id)
      .maybeSingle(),
  ])
  if (leadResult.error || interactionResult.error) throw new Error('No se pudo cargar la fuente.')
  const lead = leadResult.data
  const item = interactionResult.data
  if (!lead || !item) notFound()
  const summary = item.type === 'meeting' && typeof item.summary === 'string' ? item.summary : null
  return (
    <div className="space-y-6">
      <PageHeader
        title={item.subject || 'Interacción del lead'}
        description={`${item.type} · Registrada el ${formatDate(item.created_at)}`}
        breadcrumbs={[
          { label: 'Leads', href: '/leads' },
          { label: lead.name, href: `/leads/${id}` },
          { label: 'Fuente del historial' },
        ]}
      />
      <Card>
        <CardContent className="space-y-5 pt-6">
          {item.body ? (
            <section>
              <h2 className="mb-2 font-medium">Notas / mensaje</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {interactionBodyText(item.body)}
              </p>
            </section>
          ) : null}
          {summary ? (
            <section>
              <h2 className="mb-2 font-medium">Resumen de la reunión</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
            </section>
          ) : null}
          {!item.body && !summary ? (
            <p className="text-sm text-muted-foreground">Sin contenido adicional registrado.</p>
          ) : null}
        </CardContent>
      </Card>
      <Link href={`/leads/${id}?tab=actividad`} className="text-sm text-primary underline">
        Volver a la actividad del lead
      </Link>
    </div>
  )
}
