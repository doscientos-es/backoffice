import { Download } from 'lucide-react'
import { notFound } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { CopyPortalLink } from '@/components/portal/copy-portal-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

import { NdaForm } from './nda-form'
import { VoidNdaButton } from './void-nda-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'NDA · doscientos' }

const STATUS_LABEL = { pending: 'Pendiente de firma', signed: 'Firmado', void: 'Anulado' } as const

export default async function LeadNdaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const canEdit = user.role !== 'viewer'
  const supabase = await createServerClient()

  const [{ data: lead }, { data: ndas }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, company')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('lead_ndas')
      .select('id, portal_token, counterparty_name, status, signed_at, signed_name, created_at')
      .eq('lead_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])
  if (!lead) notFound()

  const leadName = lead.name as string
  const company = (lead.company as string | null) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="NDA"
        description={`Acuerdo de confidencialidad para ${company ? `${leadName} · ${company}` : leadName}`}
        back={<BackLink href={`/leads/${id}`} label="Volver al lead" />}
      />

      {(ndas ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>NDAs de este lead</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(ndas ?? []).map((nda) => {
              const status = nda.status as keyof typeof STATUS_LABEL
              const path = `/p/nda/${nda.portal_token as string}`
              return (
                <div key={nda.id as string} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{nda.counterparty_name as string}</span>
                    <Badge variant={status === 'signed' ? 'success' : 'outline'}>
                      {STATUS_LABEL[status]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {status === 'signed' && nda.signed_at
                        ? `por ${nda.signed_name as string} · ${formatDate(nda.signed_at as string)}`
                        : `creado ${formatDate(nda.created_at as string)}`}
                    </span>
                  </div>
                  {status !== 'void' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <CopyPortalLink path={path} label="Enlace público del NDA" />
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <a href={`${path}/pdf`}>
                          <Download aria-hidden /> PDF
                        </a>
                      </Button>
                      {canEdit && status === 'pending' ? (
                        <VoidNdaButton id={nda.id as string} leadId={id} />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Crear NDA</CardTitle>
          </CardHeader>
          <CardContent>
            <NdaForm
              leadId={id}
              defaults={{ name: company ?? leadName, representative: company ? leadName : '' }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
