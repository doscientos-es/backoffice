import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { getEmailMarketingStepDetails } from '@/lib/marketing/email-marketing'

export const metadata: Metadata = { title: 'Actividad de email - doscientos' }
export const dynamic = 'force-dynamic'

function fmtDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value))
}

function eventBadges(recipient: {
  status: string
  delivered_at: string | null
  opened_at: string | null
  click_count: number
  unsubscribed_at: string | null
  bounced_at: string | null
  complained_at: string | null
  converted_lead_id: string | null
}) {
  const events: string[] = []
  if (recipient.status === 'queued' || recipient.status === 'sending') events.push('En cola')
  else if (recipient.status === 'failed') events.push('Error')
  else if (recipient.status === 'skipped') events.push('No enviado')
  else events.push('Enviado')
  if (recipient.delivered_at) events.push('Entregado')
  if (recipient.opened_at) events.push('Abierto')
  if (recipient.click_count > 0) events.push(`Clics ${recipient.click_count}`)
  if (recipient.converted_lead_id) events.push('Formulario')
  if (recipient.unsubscribed_at) events.push('Baja')
  if (recipient.bounced_at) events.push('Rebotado')
  if (recipient.complained_at) events.push('Spam')
  return events
}

export default async function EmailMarketingStepActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  await requireUser()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
  const details = await getEmailMarketingStepDetails(id, page)

  if (!details) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Actividad del email"
          description="No se encontró este correo planificado."
          breadcrumbs={[{ label: 'Email marketing', href: '/marketing/newsletters' }]}
        />
        <Button asChild variant="outline" className="w-fit">
          <Link href="/marketing/newsletters">Volver a Email marketing</Link>
        </Button>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(details.total / details.pageSize))
  const sequenceName = details.step.sequence?.name ?? 'Secuencia'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={details.step.title}
        description={`${sequenceName} · ${details.step.sequence?.list?.name ?? 'Lista'}`}
        breadcrumbs={[
          { label: 'Email marketing', href: '/marketing/newsletters' },
          { label: sequenceName },
          { label: 'Actividad' },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/marketing/newsletters">Volver a secuencias</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{details.step.subject}</CardTitle>
          <CardDescription>
            {details.total} contactos · envío{' '}
            {details.step.sent_at
              ? `completado ${fmtDate(details.step.sent_at)}`
              : `previsto ${fmtDate(details.step.scheduled_at)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {[
            ['Entregados', details.metrics.delivered],
            ['Aperturas', details.metrics.opened],
            ['Clics', details.metrics.clicked],
            ['Formularios', details.metrics.converted],
            ['Bajas', details.metrics.unsubscribed],
            ['Rebotes', details.metrics.bounced],
            ['Quejas spam', details.metrics.complained],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actividad por contacto</CardTitle>
          <CardDescription>
            Las aperturas son orientativas; los clics y formularios muestran acciones más directas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Contacto</th>
                  <th className="py-2 pr-4 font-medium">Envío</th>
                  <th className="py-2 pr-4 font-medium">Apertura</th>
                  <th className="py-2 pr-4 font-medium">Clics</th>
                  <th className="py-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {details.recipients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Todavía no hay destinatarios preparados.
                    </td>
                  </tr>
                ) : (
                  details.recipients.map((recipient) => (
                    <tr key={`${recipient.email}-${recipient.status}`} className="align-top">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{recipient.name ?? recipient.email}</div>
                        {recipient.name ? (
                          <div className="text-xs text-muted-foreground">{recipient.email}</div>
                        ) : null}
                        {recipient.company ? (
                          <div className="text-xs text-muted-foreground">{recipient.company}</div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          {recipient.delivered_at
                            ? 'Entregado'
                            : recipient.status === 'failed'
                              ? 'Error'
                              : recipient.status === 'queued'
                                ? 'En cola'
                                : recipient.status === 'skipped'
                                  ? 'No enviado'
                                  : 'Enviado'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(recipient.sent_at)}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {recipient.opened_at ? (
                          <>
                            <span>Abierto</span>
                            <div className="text-xs text-muted-foreground">
                              {fmtDate(recipient.opened_at)}
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{recipient.click_count}</td>
                      <td className="py-3">
                        <div className="flex max-w-sm flex-wrap gap-1">
                          {eventBadges(recipient).map((event) => (
                            <Badge
                              key={event}
                              variant={
                                event === 'Error' || event === 'Rebotado' || event === 'Spam'
                                  ? 'warning'
                                  : 'outline'
                              }
                            >
                              {event}
                            </Badge>
                          ))}
                          {recipient.converted_lead_id ? (
                            <Link
                              className="text-xs font-medium underline underline-offset-2"
                              href={`/leads/${recipient.converted_lead_id}`}
                            >
                              Abrir lead
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/marketing/newsletters/steps/${id}?page=${page - 1}`}>Anterior</Link>
                </Button>
              ) : null}
              {page < totalPages ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/marketing/newsletters/steps/${id}?page=${page + 1}`}>
                    Siguiente
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
