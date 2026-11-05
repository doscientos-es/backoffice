import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EmailMarketingSequence } from '@/lib/marketing/email-marketing'

export function percent(value: number, base: number): string {
  return base
    ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format((value * 100) / base)} %`
    : '—'
}

export function MarketingAnalytics({ sequences }: { sequences: EmailMarketingSequence[] }) {
  const total = sequences
    .flatMap((sequence) => sequence.steps)
    .reduce(
      (sum, step) => ({
        sent: sum.sent + step.stats.sent,
        delivered: sum.delivered + step.stats.delivered,
        opened: sum.opened + step.stats.opened,
        clicked: sum.clicked + step.stats.clicked,
        unsubscribed: sum.unsubscribed + step.stats.unsubscribed,
      }),
      { sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0 },
    )
  const metrics = [
    ['Enviados', total.sent, 'Correos enviados'],
    ['Entregados', total.delivered, `${percent(total.delivered, total.sent)} de enviados`],
    ['Abiertos', total.opened, `${percent(total.opened, total.delivered)} de entregados`],
    ['Con clic', total.clicked, `${percent(total.clicked, total.delivered)} de entregados`],
    ['Bajas', total.unsubscribed, 'Tras un envío'],
  ] as const
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendimiento de emails</CardTitle>
        <CardDescription>
          Actividad por envío, no personas únicas entre secuencias. Las aperturas y clics son
          aproximados: los sistemas de privacidad y seguridad pueden alterarlos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
