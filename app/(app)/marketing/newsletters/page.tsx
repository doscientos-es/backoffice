import { SubmitButton } from '@doscientos/ui'
import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requireUser } from '@/lib/auth'
import { getEmailMarketingOverview } from '@/lib/marketing/email-marketing'

import {
  addEmailMarketingStepForm,
  deleteEmailMarketingStepForm,
  retryEmailMarketingStepForm,
  setEmailMarketingSequenceStatusForm,
  updateEmailMarketingStepForm,
} from './actions'
import {
  CreateListDialog,
  CreateSequenceDialog,
  DeleteListDialog,
  ImportContactsDialog,
} from './list-dialogs'

export const metadata: Metadata = { title: 'Email marketing - doscientos' }
export const dynamic = 'force-dynamic'

function dateTimeLocalDefault(monthOffset = 1): string {
  const date = new Date()
  date.setMonth(date.getMonth() + monthOffset)
  date.setDate(10)
  date.setHours(10, 0, 0, 0)
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

function dateTimeLocalValue(value: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
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

export default async function EmailMarketingPage() {
  await requireUser()
  const { lists, sequences } = await getEmailMarketingOverview()
  const listById = new Map(lists.map((list) => [list.id, list]))
  const activeSequences = sequences.filter((sequence) => sequence.status === 'active').length
  const plannedSteps = sequences.reduce(
    (sum, sequence) => sum + sequence.steps.filter((step) => step.status === 'scheduled').length,
    0,
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email marketing"
        description="Organiza contactos en listas y planifica secuencias de emails con seguimiento en el CRM."
        breadcrumbs={[{ label: 'Growth', href: '/marketing' }, { label: 'Email marketing' }]}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Listas</CardDescription>
            <CardTitle>{lists.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Secuencias activas</CardDescription>
            <CardTitle>{activeSequences}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Emails programados</CardDescription>
            <CardTitle>{plannedSteps}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>Secuencias</CardTitle>
                <CardDescription>
                  Cada correo de una secuencia se envía a la lista elegida en la fecha indicada. Las
                  horas se interpretan en horario peninsular.
                </CardDescription>
              </div>
              <CreateSequenceDialog lists={lists} />
            </CardHeader>
            <CardContent className="grid gap-4">
              {sequences.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Crea una secuencia para empezar a planificar los correos de una lista.
                </p>
              ) : (
                sequences.map((sequence) => {
                  const status = sequenceStatus[sequence.status] ?? sequenceStatus.draft!
                  const list = listById.get(sequence.list_id)
                  return (
                    <article key={sequence.id} className="rounded-xl border">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
                        <div className="grid gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold">{sequence.name}</h2>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {sequence.list_name} · {list?.contact_count ?? 0} contactos activos ·{' '}
                            {sequence.steps.length} correos
                          </p>
                        </div>
                        {sequence.status !== 'completed' ? (
                          <form action={setEmailMarketingSequenceStatusForm}>
                            <input type="hidden" name="id" value={sequence.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={sequence.status === 'active' ? 'paused' : 'active'}
                            />
                            <SubmitButton
                              variant={sequence.status === 'active' ? 'outline' : 'default'}
                              loadingLabel={
                                sequence.status === 'active' ? 'Pausando…' : 'Activando…'
                              }
                            >
                              {sequence.status === 'active'
                                ? 'Pausar secuencia'
                                : 'Activar secuencia'}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>

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
                                        aperturas · {step.stats.clicked} clics ·{' '}
                                        {step.stats.converted} formularios ·{' '}
                                        {step.stats.unsubscribed} bajas ·{' '}
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
                                    <p className="mt-2 text-xs text-destructive">
                                      {step.last_error}
                                    </p>
                                  ) : null}
                                </div>
                                {step.status === 'failed' && sequence.status === 'active' ? (
                                  <form action={retryEmailMarketingStepForm} className="self-start">
                                    <input type="hidden" name="id" value={step.id} />
                                    <SubmitButton variant="outline" loadingLabel="Reintentando…">
                                      Reintentar fallidos
                                    </SubmitButton>
                                  </form>
                                ) : null}
                              </div>
                            )
                          })
                        )}
                      </div>

                      {sequence.steps.some((step) =>
                        ['draft', 'scheduled', 'paused'].includes(step.status),
                      ) ? (
                        <details className="border-t px-4 py-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            Editar correos pendientes
                          </summary>
                          <div className="mt-3 grid gap-3">
                            {sequence.steps
                              .filter((step) =>
                                ['draft', 'scheduled', 'paused'].includes(step.status),
                              )
                              .map((step) => (
                                <form
                                  key={step.id}
                                  action={updateEmailMarketingStepForm}
                                  className="grid gap-3 rounded-lg border p-3"
                                >
                                  <input type="hidden" name="id" value={step.id} />
                                  <div className="grid gap-1.5">
                                    <Label htmlFor={`edit-title-${step.id}`}>Nombre interno</Label>
                                    <Input
                                      id={`edit-title-${step.id}`}
                                      name="title"
                                      required
                                      maxLength={140}
                                      defaultValue={step.title}
                                    />
                                  </div>
                                  <div className="grid gap-1.5">
                                    <Label htmlFor={`edit-subject-${step.id}`}>Asunto</Label>
                                    <Input
                                      id={`edit-subject-${step.id}`}
                                      name="subject"
                                      required
                                      maxLength={160}
                                      defaultValue={step.subject}
                                    />
                                  </div>
                                  <div className="grid gap-1.5">
                                    <Label htmlFor={`edit-preview-${step.id}`}>Vista previa</Label>
                                    <Input
                                      id={`edit-preview-${step.id}`}
                                      name="previewText"
                                      maxLength={220}
                                      defaultValue={step.preview_text ?? ''}
                                    />
                                  </div>
                                  <div className="grid gap-1.5">
                                    <Label htmlFor={`edit-date-${step.id}`}>Fecha y hora</Label>
                                    <Input
                                      id={`edit-date-${step.id}`}
                                      name="scheduledAt"
                                      type="datetime-local"
                                      required
                                      defaultValue={dateTimeLocalValue(step.scheduled_at)}
                                    />
                                  </div>
                                  <div className="grid gap-1.5">
                                    <Label htmlFor={`edit-body-${step.id}`}>Contenido</Label>
                                    <Textarea
                                      id={`edit-body-${step.id}`}
                                      name="bodyMarkdown"
                                      required
                                      maxLength={30000}
                                      className="min-h-28"
                                      defaultValue={step.body_markdown}
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <SubmitButton variant="outline" loadingLabel="Guardando…">
                                      Guardar cambios
                                    </SubmitButton>
                                    <SubmitButton
                                      formAction={deleteEmailMarketingStepForm}
                                      formNoValidate
                                      name="id"
                                      value={step.id}
                                      variant="ghost"
                                      loadingLabel="Eliminando…"
                                    >
                                      Eliminar email
                                    </SubmitButton>
                                  </div>
                                </form>
                              ))}
                          </div>
                        </details>
                      ) : null}

                      <details className="border-t p-4">
                        <summary className="cursor-pointer text-sm font-medium">
                          Planificar otro email
                        </summary>
                        <form action={addEmailMarketingStepForm} className="mt-4 grid gap-3">
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
                          <div className="grid gap-1.5">
                            <Label htmlFor={`step-subject-${sequence.id}`}>Asunto del email</Label>
                            <Input
                              id={`step-subject-${sequence.id}`}
                              name="subject"
                              required
                              maxLength={160}
                              placeholder="¿Cuánto tiempo pierde tu equipo en tareas manuales?"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`step-preview-${sequence.id}`}>
                              Texto de vista previa
                            </Label>
                            <Input
                              id={`step-preview-${sequence.id}`}
                              name="previewText"
                              maxLength={220}
                              placeholder="Una idea concreta para mejorar el proceso."
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`step-date-${sequence.id}`}>
                              Fecha y hora de envío
                            </Label>
                            <Input
                              id={`step-date-${sequence.id}`}
                              name="scheduledAt"
                              type="datetime-local"
                              required
                              defaultValue={dateTimeLocalDefault()}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`step-body-${sequence.id}`}>Contenido</Label>
                            <Textarea
                              id={`step-body-${sequence.id}`}
                              name="bodyMarkdown"
                              required
                              maxLength={30000}
                              className="min-h-36"
                              placeholder={
                                'Hola {{nombre}},\n\nAquí va el mensaje. Puedes usar {{empresa}} y {{email}}.'
                              }
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Al guardar queda pendiente. Solo se enviará si activas la secuencia. La
                            baja aparecerá destacada al principio y al final del email.
                          </p>
                          <SubmitButton className="w-fit" loadingLabel="Guardando…">
                            Guardar email planificado
                          </SubmitButton>
                        </form>
                      </details>
                    </article>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>Listas</CardTitle>
                <CardDescription>
                  Una empresa puede pertenecer a más de una lista. Las bajas y rebotes se aplican
                  globalmente.
                </CardDescription>
              </div>
              <CreateListDialog />
            </CardHeader>
            <CardContent className="grid gap-3">
              {lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay listas.</p>
              ) : (
                lists.map((list) => (
                  <div key={list.id} className="grid gap-3 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{list.name}</p>
                        {list.description ? (
                          <p className="text-xs text-muted-foreground">{list.description}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="outline">{list.contact_count}</Badge>
                        <DeleteListDialog list={list} />
                      </div>
                    </div>
                    <ImportContactsDialog list={list} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  )
}
