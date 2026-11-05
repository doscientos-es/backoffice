import { SubmitButton } from '@doscientos/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireUser } from '@/lib/auth'
import { externalAppUrl } from '@/lib/email/app-url'
import { publicEnv, serverEnv } from '@/lib/env'
import { getEmailMarketingOverview } from '@/lib/marketing/email-marketing'

import { ActionForm } from './action-form'
import {
  addEmailMarketingStep,
  retryEmailMarketingStep,
  setEmailMarketingSequenceStatus,
} from './actions'
import { DeleteSequenceDialog, EditMarketingDialog } from './manage-dialogs'
import { MessageFields } from './message-fields'
import { SendNowDialog } from './send-now-dialog'
import { StepEditor } from './step-editor'
import { MarketingWorkspace } from './workspace'

export const metadata: Metadata = { title: 'Email marketing - doscientos' }
export const dynamic = 'force-dynamic'

function dateTimeLocalDefault(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`
}

function fmtDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value))
}

const sequenceStatus: Record<
  string,
  { label: string; variant: 'neutral' | 'info' | 'success' | 'warning' }
> = {
  draft: { label: 'Borrador', variant: 'neutral' },
  active: { label: 'Activa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  completed: { label: 'Completada', variant: 'neutral' },
}

const stepStatus: Record<
  string,
  { label: string; variant: 'neutral' | 'info' | 'success' | 'warning' }
> = {
  draft: { label: 'Borrador', variant: 'neutral' },
  scheduled: { label: 'Pendiente', variant: 'info' },
  sending: { label: 'Enviando', variant: 'warning' },
  sent: { label: 'Enviado', variant: 'success' },
  paused: { label: 'Pausado', variant: 'warning' },
  failed: { label: 'Revisar error', variant: 'warning' },
}

export default async function EmailMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; sequence?: string; page?: string }>
}) {
  const user = await requireUser()
  const env = serverEnv()
  const sendingConfigured = Boolean(env.EMAIL_MARKETING_RESEND_API_KEY || env.RESEND_API_KEY)
  const { lists, sequences } = await getEmailMarketingOverview()
  const params = await searchParams
  const list = lists.find((item) => item.id === params.list)
  const sequence = sequences.find(
    (item) => item.id === params.sequence && item.list_id === list?.id,
  )
  if ((params.list && !list) || (params.sequence && !sequence)) notFound()
  const pageNumber = Number(params.page)
  const page =
    Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 100000 ? pageNumber : 1

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={sequence?.name ?? list?.name ?? 'Email marketing'}
        description={
          sequence
            ? `Secuencia de ${list?.name} · horas en horario peninsular`
            : list
              ? 'Gestiona los contactos y las secuencias de esta lista.'
              : 'Organiza tus contactos y planifica tus envíos desde un solo lugar.'
        }
        breadcrumbs={[
          { label: 'Growth', href: '/marketing' },
          { label: 'Email marketing', href: list ? '/marketing/newsletters' : undefined },
          ...(list
            ? [
                {
                  label: list.name,
                  href: sequence ? `/marketing/newsletters?list=${list.id}` : undefined,
                },
              ]
            : []),
          ...(sequence ? [{ label: sequence.name }] : []),
        ]}
      />

      {!list && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-5 py-4 text-sm">
          <div>
            <p className="font-medium">Remitente de marketing · {env.EMAIL_MARKETING_FROM_EMAIL}</p>
            <p className="mt-1 text-muted-foreground">
              {sendingConfigured
                ? 'Clave de Resend configurada; la conexión y el programador no se han verificado desde aquí.'
                : 'Falta configurar una clave de Resend para poder enviar.'}
            </p>
          </div>
          <Badge variant={sendingConfigured ? 'outline' : 'warning'}>
            {sendingConfigured ? 'Configuración presente' : 'Configuración pendiente'}
          </Badge>
        </div>
      )}

      {!sequence ? (
        <MarketingWorkspace
          lists={lists}
          sequences={sequences}
          list={list}
          page={page}
          appUrl={externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)}
        />
      ) : (
        <section className="grid gap-4">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="grid gap-1">
                  <CardTitle>Emails de la secuencia</CardTitle>
                  <CardDescription>
                    Cada correo de una secuencia se envía a la lista elegida en la fecha indicada.
                    Las horas se interpretan en horario peninsular.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EditMarketingDialog target={{ kind: 'sequence', value: sequence }} />
                  <DeleteSequenceDialog sequence={sequence} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <article key={sequence.id} className="rounded-xl border">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{sequence.name}</h2>
                        <Badge
                          variant={
                            (sequenceStatus[sequence.status] ?? sequenceStatus.draft!).variant
                          }
                        >
                          {(sequenceStatus[sequence.status] ?? sequenceStatus.draft!).label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {sequence.list_name} · {list?.contact_count ?? 0} contactos activos ·{' '}
                        {sequence.steps.length} correos
                      </p>
                    </div>
                    {sequence.status !== 'completed' ? (
                      <ActionForm
                        action={setEmailMarketingSequenceStatus}
                        success={
                          sequence.status === 'active' ? 'Secuencia pausada' : 'Secuencia activada'
                        }
                      >
                        <input type="hidden" name="id" value={sequence.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={sequence.status === 'active' ? 'paused' : 'active'}
                        />
                        <SubmitButton
                          variant={sequence.status === 'active' ? 'outline' : 'default'}
                          loadingLabel={sequence.status === 'active' ? 'Pausando…' : 'Activando…'}
                        >
                          {sequence.status === 'active' ? 'Pausar secuencia' : 'Activar secuencia'}
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                  {sequence.status !== 'active' &&
                    sequence.steps.some(
                      (step) =>
                        step.status === 'scheduled' &&
                        new Date(step.scheduled_at).getTime() <= Date.now(),
                    ) && (
                      <p className="border-b bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        Hay emails con fecha pasada: al activar la secuencia podrán enviarse de
                        inmediato. Revisa sus fechas antes de activarla.
                      </p>
                    )}

                  <div className="grid gap-3 p-4">
                    {sequence.steps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aún no hay correos planificados.
                      </p>
                    ) : (
                      sequence.steps.map((step) => {
                        const stepBadge = stepStatus[step.status] ?? stepStatus.draft!
                        return (
                          <div
                            key={step.id}
                            className="grid gap-3 rounded-lg bg-muted/40 p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Email {step.position}
                                </span>
                                <Badge variant={stepBadge.variant}>{stepBadge.label}</Badge>
                              </div>
                              <h3 className="mt-1 truncate font-medium">{step.title}</h3>
                              <p className="truncate text-sm text-muted-foreground">
                                {step.subject}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {step.status === 'sent' && step.sent_at
                                  ? `Enviado ${fmtDate(step.sent_at)}`
                                  : `Programado ${fmtDate(step.scheduled_at)}`}
                              </p>
                              {step.stats.recipients > 0 ? (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>
                                    {step.stats.delivered} entregados · {step.stats.opened}{' '}
                                    aperturas · {step.stats.clicked} clics · {step.stats.converted}{' '}
                                    formularios · {step.stats.unsubscribed} bajas ·{' '}
                                    {step.stats.bounced + step.stats.complained} incidencias
                                  </span>
                                  <Link
                                    href={`/marketing/newsletters/steps/${step.id}`}
                                    className="font-medium text-foreground underline underline-offset-2"
                                  >
                                    Ver actividad por contacto
                                  </Link>
                                </div>
                              ) : null}
                              {step.last_error ? (
                                <p className="mt-2 text-xs text-destructive">{step.last_error}</p>
                              ) : null}
                              {step.status === 'scheduled' && (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <SendNowDialog
                                    id={step.id}
                                    title={step.title}
                                    listName={sequence.list_name}
                                    count={list?.contact_count ?? 0}
                                    active={sequence.status === 'active'}
                                    configured={sendingConfigured}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {sequence.status !== 'active'
                                      ? 'Activa la secuencia para enviar.'
                                      : !sendingConfigured
                                        ? 'Configura Resend para enviar.'
                                        : !list?.contact_count
                                          ? 'Añade contactos suscritos para enviar.'
                                          : 'O espera a la fecha programada.'}
                                  </span>
                                </div>
                              )}
                              <details className="mt-3 text-sm">
                                <summary className="cursor-pointer font-medium">
                                  Ver contenido
                                </summary>
                                {step.preview_text && (
                                  <p className="mt-2 text-muted-foreground">
                                    Vista previa: {step.preview_text}
                                  </p>
                                )}
                                <div className="mt-2 rounded-lg border bg-background p-3 break-words whitespace-pre-wrap">
                                  {step.body_markdown}
                                </div>
                              </details>
                              {['draft', 'scheduled', 'paused'].includes(step.status) && (
                                <StepEditor
                                  step={step}
                                  canDelete={['owner', 'admin'].includes(user.role)}
                                />
                              )}
                            </div>
                            {step.status === 'failed' &&
                            sequence.status === 'active' &&
                            ['owner', 'admin'].includes(user.role) ? (
                              <ActionForm
                                action={retryEmailMarketingStep}
                                success="Envíos fallidos en cola"
                                className="self-start"
                              >
                                <input type="hidden" name="id" value={step.id} />
                                <SubmitButton variant="outline" loadingLabel="Reintentando…">
                                  Reintentar fallidos
                                </SubmitButton>
                              </ActionForm>
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {sequence.status !== 'completed' && (
                    <details
                      className="border-t p-4"
                      open={sequence.steps.length === 0 || undefined}
                    >
                      <summary className="cursor-pointer text-sm font-medium">
                        + Añadir email a la secuencia
                      </summary>
                      <ActionForm
                        action={addEmailMarketingStep}
                        success="Email planificado"
                        resetOnSuccess
                        className="mt-4 grid gap-3"
                      >
                        <input type="hidden" name="sequenceId" value={sequence.id} />
                        <div className="grid gap-1.5">
                          <Label htmlFor={`step-title-${sequence.id}`}>Nombre interno</Label>
                          <Input
                            id={`step-title-${sequence.id}`}
                            name="title"
                            required
                            maxLength={140}
                            placeholder="Caso práctico de automatización"
                          />
                        </div>
                        <MessageFields id={`new-${sequence.id}`} />
                        <div className="grid gap-1.5">
                          <Label htmlFor={`step-date-${sequence.id}`}>Fecha y hora de envío</Label>
                          <Input
                            id={`step-date-${sequence.id}`}
                            name="scheduledAt"
                            type="datetime-local"
                            required
                            defaultValue={dateTimeLocalDefault()}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Al guardar queda pendiente.{' '}
                          {sequence.status === 'active'
                            ? 'La secuencia está activa: se enviará al llegar la fecha.'
                            : 'Solo se enviará si activas la secuencia.'}{' '}
                          Después de guardarlo también podrás elegir «Enviar ahora».
                        </p>
                        <SubmitButton className="w-fit" loadingLabel="Guardando…">
                          Guardar email planificado
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                </article>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}
