'use client'

import { Download } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type CommercialPerformance,
  type DurationSummary,
  formatDuration,
} from '@/lib/leads/commercial-performance'
import { formatEUR } from '@/lib/utils'

const percentage = (value: number | null) => (value === null ? 'Sin datos' : `${value.toFixed(1)}%`)
const TIMINGS: { key: keyof CommercialPerformance['timing']; label: string; definition: string }[] =
  [
    {
      key: 'firstContact',
      label: 'Primer contacto',
      definition: 'Entrada del lead → primer contacto registrado',
    },
    {
      key: 'leadToProposal',
      label: 'Entrega de propuesta',
      definition: 'Entrada del lead → primer envío de propuesta',
    },
    {
      key: 'preparation',
      label: 'Preparación de propuesta',
      definition: 'Creación del borrador → envío',
    },
    {
      key: 'firstView',
      label: 'Primera apertura',
      definition: 'Envío → primera apertura registrada del cliente',
    },
    { key: 'acceptance', label: 'Aceptación', definition: 'Envío → aceptación registrada' },
    { key: 'rejection', label: 'Rechazo', definition: 'Envío → rechazo registrado' },
    {
      key: 'leadToWin',
      label: 'Ciclo de venta',
      definition: 'Entrada del lead ganado → primer cambio a Ganado',
    },
    {
      key: 'delivery',
      label: 'Entrega del proyecto',
      definition: 'Aceptación → firma del albarán de entrega',
    },
    {
      key: 'pendingAge',
      label: 'Espera actual de respuesta',
      definition: 'Envío de propuesta pendiente → ahora',
    },
    {
      key: 'draftAge',
      label: 'Edad actual de borradores',
      definition: 'Creación de borrador pendiente → ahora',
    },
  ]

export function CommercialPerformancePanel({
  performance: p,
  canSeePrices,
  since,
  until,
}: {
  performance: CommercialPerformance
  canSeePrices: boolean
  since: string
  until: string
}) {
  const exportMetrics = () => {
    const report = {
      version: 1,
      exportedAt: new Date().toISOString(),
      window: { since, until },
      methodology: {
        durations:
          'Horas naturales; solo pares de fechas válidos. Media, mediana y P90 (rango más próximo).',
        cohorts:
          'Leads y propuestas creados en el periodo; estado y evolución hasta ahora. Actividad registrada dentro del periodo.',
        attribution:
          'Leads: responsable actual. Propuestas: autor del borrador. Actividad: performed_by.',
        money:
          'Importes de propuestas con IVA, no ingresos cobrados. null significa sin precio visible.',
        coverage: 'Leads activos de la cohorte con al menos un recordatorio pendiente futuro.',
      },
      metrics: p,
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `metricas-comerciales-${since}-${until}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const stats = [
    ['Propuestas creadas', String(p.proposalCount)],
    ['Enviadas', String(p.sent)],
    ['Aceptadas', String(p.accepted)],
    ['Rechazadas', String(p.rejected)],
    ['Pendientes de respuesta', String(p.pending)],
    ['Borradores pendientes', String(p.drafts)],
    ['Apertura / enviadas', percentage(p.viewRate)],
    ['Aceptación / enviadas', percentage(p.acceptanceRate)],
    ['Aceptación / decididas enviadas', percentage(p.decidedAcceptanceRate)],
    ['Seguimiento programado', percentage(p.coverageRate)],
    ['Activos sin recordatorio futuro', String(p.withoutNextStep)],
    ['Pendientes +72 h', String(p.waiting72h)],
    ...(canSeePrices
      ? [
          [
            'Valor aceptado · con IVA',
            p.acceptedValue === null ? 'Sin datos' : formatEUR(p.acceptedValue),
          ],
          [
            'Ticket medio aceptado · con IVA',
            p.averageAcceptedValue === null ? 'Sin datos' : formatEUR(p.averageAcceptedValue),
          ],
          [
            'Valor pendiente · con IVA',
            p.pendingValue === null ? 'Sin datos' : formatEUR(p.pendingValue),
          ],
        ]
      : []),
  ]

  return (
    <section className="flex flex-col gap-4" aria-label="Rendimiento comercial">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rendimiento comercial</h2>
          <p className="text-sm text-muted-foreground">
            Tiempos, resultados y seguimiento para mejorar el cierre.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/proposals?followup=waiting_72">Revisar pendientes +72 h</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportMetrics}>
            <Download className="size-4" />
            Exportar métricas JSON
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Cohortes: {p.leadCount} leads y {p.proposalCount} propuestas creados entre {since} y {until}
        , con su evolución hasta ahora. La actividad corresponde a registros creados en ese periodo.
        El seguimiento mide recordatorios pendientes futuros de los {p.active} leads activos de la
        cohorte.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tiempos comerciales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tramo</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Mediana</TableHead>
                <TableHead>P90</TableHead>
                <TableHead>Muestras válidas</TableHead>
                <TableHead>Sin fechas / inválidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIMINGS.map(({ key, label, definition }) => {
                const timing = p.timing[key]
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{definition}</p>
                    </TableCell>
                    <TableCell>{formatDuration(timing.meanHours)}</TableCell>
                    <TableCell>{formatDuration(timing.medianHours)}</TableCell>
                    <TableCell>{formatDuration(timing.p90Hours)}</TableCell>
                    <TableCell>{timing.count}</TableCell>
                    <TableCell>
                      {timing.missing} / {timing.invalid}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Horas y días naturales, no laborables. Mediana = caso central; P90 = tiempo que no
            supera el 90 % de las muestras. Las fechas ausentes, futuras o invertidas no cuentan
            como cero. Las operaciones aún pendientes no se incluyen en los tiempos de aceptación o
            entrega: su espera se muestra aparte.
            {p.manualAcceptances > 0
              ? ` Hay ${p.manualAcceptances} aceptaciones sin envío registrado, excluidas del tiempo envío → aceptación.`
              : ''}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Marcador comercial · base para gamificación</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsable / autor</TableHead>
                <TableHead>Leads / ganados</TableHead>
                <TableHead>Conversión</TableHead>
                <TableHead>Enviadas / aceptadas</TableHead>
                {canSeePrices ? <TableHead>Valor aceptado</TableHead> : null}
                <TableHead>Primer contacto</TableHead>
                <TableHead>Preparación</TableHead>
                <TableHead>Aceptación</TableHead>
                <TableHead>Seguimiento</TableHead>
                <TableHead>Llamadas / emails / reuniones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.byMember.map((member) => (
                <TableRow key={member.id ?? 'unassigned'}>
                  <TableCell>
                    <span className="font-medium">{member.name}</span>
                  </TableCell>
                  <TableCell>
                    {member.leads} / {member.won}
                  </TableCell>
                  <TableCell>{percentage(member.conversionRate)}</TableCell>
                  <TableCell>
                    {member.sent} / {member.accepted}
                  </TableCell>
                  {canSeePrices ? (
                    <TableCell>
                      {member.acceptedValue === null
                        ? 'Sin datos'
                        : formatEUR(member.acceptedValue)}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <SampleMedian value={member.firstContact} />
                  </TableCell>
                  <TableCell>
                    <SampleMedian value={member.preparation} />
                  </TableCell>
                  <TableCell>
                    <SampleMedian value={member.acceptance} />
                  </TableCell>
                  <TableCell>
                    {member.covered} / {member.active} activos
                  </TableCell>
                  <TableCell>
                    {member.calls} / {member.emails} / {member.meetings}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {p.byMember.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Sin actividad comercial en esta cohorte.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Ordenado por propuestas aceptadas y leads ganados, sin puntos por acumular llamadas.
            Leads atribuidos al responsable actual; propuestas al autor del borrador (no
            necesariamente quien cierra); actividad a quien la registró. Tiempos por persona:
            mediana y tamaño de muestra. Compara cohortes y carga de trabajo antes de usarlo para
            premios; no es una atribución histórica del cierre.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Actividad registrada: {p.calls} llamadas · {p.emails} emails enviados · {p.replies}{' '}
            emails recibidos · {p.meetings} reuniones. Una apertura no prueba intención de compra.
            Una aceptación no equivale a cobro.
            {canSeePrices
              ? ` Importes disponibles en ${p.pricedAccepted} de ${p.accepted} propuestas aceptadas; el ticket medio solo usa esas propuestas.`
              : ''}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}

function SampleMedian({ value }: { value: DurationSummary }) {
  return (
    <span>
      {formatDuration(value.medianHours)}{' '}
      <span className="text-xs text-muted-foreground">(n={value.count})</span>
    </span>
  )
}
