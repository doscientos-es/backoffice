'use client'
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import type { CommandCenterMetrics } from '@/lib/finance/command-center'
import { formatEUR } from '@/lib/utils'

export function CommandCenter({ metrics }: { metrics: CommandCenterMetrics }) {
  const model = useMemo(() => {
    const gross = metrics.revenue - metrics.directCosts
    const preTax = gross - metrics.fixedCosts
    const avg = metrics.invoiceCount ? metrics.revenue / metrics.invoiceCount : 0
    const cac = metrics.wonLeads ? metrics.adSpend / metrics.wonLeads : 0
    return { gross, preTax, avg, cac }
  }, [metrics])
  const eur = (v: number) => formatEUR(Math.round(v * 100) / 100)
  return (
    <section className="flex flex-col gap-4" aria-labelledby="command-center-title">
      <div>
        <h2 id="command-center-title" className="text-xl font-semibold tracking-tight">
          Centro de mando
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresos − costes directos = margen bruto; después estructura e impuestos estimados.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Margen bruto', model.gross, 'Ingresos − costes directos'],
          ['Beneficio pre impuestos', model.preTax, 'Después de estructura'],
          ['Ticket medio', model.avg, `${metrics.invoiceCount} facturas`],
          ['CAC publicitario', model.cac, `${metrics.wonLeads} clientes ganados`],
        ].map(([label, value, hint]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{eur(Number(value))}</p>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Vista de gestión, no liquidación fiscal. Costes directos {eur(metrics.directCosts)} ·
        estructura {eur(metrics.fixedCosts)} · horas {metrics.hours.toFixed(1)} h · Ads{' '}
        {eur(metrics.adSpend)}.
      </p>
    </section>
  )
}
