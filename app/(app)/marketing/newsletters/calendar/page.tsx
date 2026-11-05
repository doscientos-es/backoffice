import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { getEmailMarketingOverview } from '@/lib/marketing/email-marketing'

export const metadata = { title: 'Calendario de email marketing - doscientos' }
export const dynamic = 'force-dynamic'

const base = '/marketing/newsletters/calendar'
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
function dayKey(value: Date) {
  const parts = Object.fromEntries(
    dateParts.formatToParts(value).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}
function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

export default async function MarketingCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  await requireUser()
  const { sequences } = await getEmailMarketingOverview()
  const requested = (await searchParams).month
  const current = dayKey(new Date()).slice(0, 7)
  const month =
    requested && /^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$/.test(requested) ? requested : current
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const offset = (first.getUTCDay() + 6) % 7
  const previous = monthKey(new Date(Date.UTC(year, monthNumber - 2, 1)))
  const next = monthKey(new Date(Date.UTC(year, monthNumber, 1)))
  const entries = sequences
    .flatMap((sequence) =>
      sequence.steps.map((step) => ({ sequence, step, day: dayKey(new Date(step.scheduled_at)) })),
    )
    .filter((entry) => entry.day.startsWith(month))
    .sort((a, b) => a.step.scheduled_at.localeCompare(b.step.scheduled_at))
  const title = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(first)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendario de envíos"
        description="Planificación de todos los correos en horario peninsular. Las secuencias pausadas no se envían."
        breadcrumbs={[
          { label: 'Email marketing', href: '/marketing/newsletters' },
          { label: 'Calendario' },
        ]}
      />
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="capitalize">{title}</CardTitle>
          <nav className="flex gap-3 text-sm" aria-label="Navegar meses">
            <Link className="underline" href={`${base}?month=${previous}`}>
              Anterior
            </Link>
            <Link className="underline" href={base}>
              Hoy
            </Link>
            <Link className="underline" href={`${base}?month=${next}`}>
              Siguiente
            </Link>
          </nav>
        </CardHeader>
        <CardContent>
          <div className="hidden grid-cols-7 gap-px bg-border md:grid">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div
                key={day}
                className="bg-background p-2 text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
              .slice(0, offset)
              .map((day) => (
                <div key={day} className="bg-muted/20" />
              ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const key = `${month}-${String(i + 1).padStart(2, '0')}`
              const dayEntries = entries.filter((entry) => entry.day === key)
              return (
                <div key={key} className="min-h-24 bg-background p-2">
                  <span className="text-xs font-semibold">{i + 1}</span>
                  <div className="mt-1 grid gap-1">
                    {dayEntries.map(({ sequence, step }) => (
                      <Link
                        key={step.id}
                        href={`/marketing/newsletters?list=${sequence.list_id}&sequence=${sequence.id}`}
                        className="rounded bg-muted p-1 text-xs break-words hover:bg-accent"
                      >
                        {step.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 grid gap-2">
            <h2 className="font-semibold">Agenda del mes</h2>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay correos planificados este mes.</p>
            ) : (
              entries.map(({ sequence, step }) => (
                <Link
                  key={step.id}
                  href={`/marketing/newsletters?list=${sequence.list_id}&sequence=${sequence.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {sequence.list_name} · {sequence.name} ·{' '}
                      {new Intl.DateTimeFormat('es-ES', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Europe/Madrid',
                      }).format(new Date(step.scheduled_at))}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {sequence.status !== 'active' && step.status === 'scheduled'
                      ? 'Secuencia pausada'
                      : {
                          scheduled: 'Pendiente',
                          sent: 'Enviado',
                          sending: 'Enviando',
                          draft: 'Borrador',
                          paused: 'Pausado',
                          failed: 'Error',
                        }[step.status]}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
