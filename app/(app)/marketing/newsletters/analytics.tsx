import {
  ArrowUpRight,
  BarChart3,
  Eye,
  MailCheck,
  MousePointerClick,
  Send,
  UserRoundMinus,
} from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import type { EmailMarketingSequence } from '@/lib/marketing/email-marketing'

export function percent(value: number, base: number): string {
  return base
    ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format((value * 100) / base)} %`
    : '—'
}

export function MarketingAnalytics({ sequences }: { sequences: EmailMarketingSequence[] }) {
  const steps = sequences.flatMap((sequence) =>
    sequence.steps.map((step) => ({ ...step, sequenceName: sequence.name })),
  )
  const total = steps.reduce(
    (sum, step) => ({
      sent: sum.sent + step.stats.sent,
      delivered: sum.delivered + step.stats.delivered,
      opened: sum.opened + step.stats.opened,
      clicked: sum.clicked + step.stats.clicked,
      unsubscribed: sum.unsubscribed + step.stats.unsubscribed,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0 },
  )
  const recent = steps
    .filter(
      (step) =>
        step.status === 'sent' &&
        step.sent_at &&
        step.stats.sent > 0 &&
        !Number.isNaN(Date.parse(step.sent_at)),
    )
    .sort((a, b) => Date.parse(a.sent_at!) - Date.parse(b.sent_at!))
    .slice(-6)
  const chartMax = Math.max(1, ...recent.flatMap((step) => [step.stats.opened, step.stats.clicked]))
  const number = new Intl.NumberFormat('es-ES')
  const date = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'Europe/Madrid',
  })
  const metrics = [
    {
      label: 'Enviados',
      value: total.sent,
      hint: 'En total',
      icon: Send,
      color: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    },
    {
      label: 'Entregados',
      value: total.delivered,
      hint: `${percent(total.delivered, total.sent)} de enviados`,
      icon: MailCheck,
      color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Abiertos',
      value: total.opened,
      hint: `${percent(total.opened, total.delivered)} de entregados`,
      icon: Eye,
      color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    },
    {
      label: 'Con clic',
      value: total.clicked,
      hint: `${percent(total.clicked, total.delivered)} de entregados`,
      icon: MousePointerClick,
      color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    {
      label: 'Bajas',
      value: total.unsubscribed,
      hint: 'Tras un envío',
      icon: UserRoundMinus,
      color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    },
  ] as const
  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Rendimiento de emails</h2>
            <p className="text-xs text-muted-foreground">
              Una visión de toda tu actividad de email marketing
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            Histórico
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {metrics.map(({ label, value, hint, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className={`rounded-md p-1.5 ${color}`}>
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                {label}
              </div>
              <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                {number.format(value)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-muted/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="size-4 text-muted-foreground" aria-hidden="true" /> Evolución
                por envío
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Resultados acumulados de los últimos 6 emails finalizados, por fecha de
                finalización.
              </p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-violet-500" /> Aperturas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" /> Clics
              </span>
            </div>
          </div>
          {recent.length === 0 ? (
            <div className="flex min-h-28 items-center justify-center text-center text-sm text-muted-foreground">
              Cuando completes un envío, verás aquí su evolución.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <section
                className="flex min-w-[360px] items-end gap-2"
                aria-label="Aperturas y clics por email finalizado"
              >
                {recent.map((step) => {
                  const sentDate = date.format(new Date(step.sent_at!))
                  const label = `${step.title}, ${step.sequenceName}, finalizado el ${sentDate}: ${number.format(step.stats.opened)} aperturas y ${number.format(step.stats.clicked)} ${step.stats.clicked === 1 ? 'clic' : 'clics'}`
                  return (
                    <Link
                      key={step.id}
                      href={`/marketing/newsletters/steps/${step.id}`}
                      aria-label={label}
                      title={label}
                      className="group min-w-0 flex-1 rounded-lg px-1 py-1 text-center hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <div className="flex h-28 items-end justify-center gap-1 border-b">
                        {(
                          [
                            ['opened', 'bg-violet-500'],
                            ['clicked', 'bg-amber-500'],
                          ] as const
                        ).map(([key, color]) => (
                          <div
                            key={key}
                            className="flex h-full w-7 flex-col items-center justify-end gap-1"
                          >
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {number.format(step.stats[key])}
                            </span>
                            <span
                              className={`w-full rounded-t-sm ${color}`}
                              style={{ height: `${(step.stats[key] / chartMax) * 75}%` }}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs font-medium">{sentDate}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground group-hover:text-foreground">
                        {step.title}
                      </p>
                    </Link>
                  )
                })}
              </section>
              <p className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                Selecciona un email para ver su actividad{' '}
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Actividad por envío, no personas únicas entre secuencias. Las aperturas y clics son
          aproximados: los sistemas de privacidad y seguridad pueden alterarlos.
        </p>
      </CardContent>
    </Card>
  )
}
