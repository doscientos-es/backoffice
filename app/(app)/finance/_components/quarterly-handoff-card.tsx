'use client'

import { CalendarClock, Download, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import type { QuarterlyHandoff } from '@/lib/finance/quarterly-handoff'
import { cn, formatDate, formatDateTime } from '@/lib/utils'

import { QuarterlySendDialog } from './quarterly-send-dialog'

export type HandoffQuarter = {
  year: number
  quarter: number
  label: string
  sentAt: string | null
}

const AUTO_OPEN_KEY = 'finance.quarterlyHandoff.autoOpened'

function notice(handoff: QuarterlyHandoff): { tone: string; text: string } | null {
  const { status, period, daysUntilHandoff, handoffDate, filingDeadline } = handoff
  switch (status) {
    case 'upcoming':
      return {
        tone: 'border-amber-300 bg-amber-50 text-amber-900',
        text:
          daysUntilHandoff <= 0
            ? `Hoy cierra el ${period.label}: mañana toca enviarlo a la gestoría.`
            : `El ${period.label} cierra en ${daysUntilHandoff} día${daysUntilHandoff === 1 ? '' : 's'}. El ${formatDate(handoffDate)} toca enviar las facturas y gastos a la gestoría.`,
      }
    case 'due':
      return {
        tone: 'border-sky-300 bg-sky-50 text-sky-900',
        text: `Toca enviar el ${period.label} a la gestoría (presentación hasta el ${formatDate(filingDeadline)}).`,
      }
    case 'overdue':
      return {
        tone: 'border-red-300 bg-red-50 text-red-900',
        text: `El ${period.label} no consta como enviado a la gestoría y el plazo de presentación (${formatDate(filingDeadline)}) ya pasó.`,
      }
    default:
      return null
  }
}

export function QuarterlyHandoffCard({
  handoff,
  quarters,
  advisorEmail,
}: {
  handoff: QuarterlyHandoff
  quarters: HandoffQuarter[]
  advisorEmail: string
}) {
  const feedback = useFormFeedback()
  const [selected, setSelected] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const current = quarters[selected]
  const banner = notice(handoff)

  // Open the send dialog once per session on the hand-off day(s).
  useEffect(() => {
    if (handoff.status !== 'due') return
    const key = `${AUTO_OPEN_KEY}.${handoff.period.label}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const index = quarters.findIndex(
      (q) => q.year === handoff.period.year && q.quarter === handoff.period.quarter,
    )
    if (index >= 0) setSelected(index)
    setDialogOpen(true)
  }, [handoff, quarters])

  const downloadHref = (format: 'xlsx' | 'csv') =>
    current
      ? `/api/invoices/trimestral?year=${current.year}&quarter=${current.quarter}&format=${format}`
      : '#'

  return (
    <section className="flex flex-col gap-3" aria-labelledby="quarterly-handoff-title">
      <h2 id="quarterly-handoff-title" className="text-xl font-semibold tracking-tight">
        Cierre trimestral para la gestoría
      </h2>
      {banner ? (
        <div className={cn('flex items-start gap-2 rounded-md border p-3 text-sm', banner.tone)}>
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{banner.text}</p>
        </div>
      ) : null}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="grid gap-1.5 text-sm font-medium" htmlFor="quarterly-handoff-quarter">
            Trimestre
            <select
              id="quarterly-handoff-quarter"
              className="border-input h-9 rounded-md border bg-background px-3 text-sm"
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
            >
              {quarters.map((q, index) => (
                <option key={q.label} value={index}>
                  {q.label}
                  {q.sentAt ? ' · enviado' : ''}
                </option>
              ))}
            </select>
          </label>
          <Button asChild variant="outline" size="sm">
            <a href={downloadHref('xlsx')} download>
              <Download className="size-3.5" aria-hidden />
              Excel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={downloadHref('csv')} download>
              <Download className="size-3.5" aria-hidden />
              CSV
            </a>
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!current}>
            <Mail className="size-3.5" aria-hidden />
            Enviar a {advisorEmail}
          </Button>
          <FormFeedback state={feedback.state} />
          <p className="basis-full text-xs text-muted-foreground">
            {current?.sentAt
              ? `Último envío del ${current.label}: ${formatDateTime(current.sentAt)}.`
              : `El ${current?.label ?? 'trimestre'} aún no se ha enviado a la gestoría.`}
          </p>
        </CardContent>
      </Card>
      {current ? (
        <QuarterlySendDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          quarter={current}
          advisorEmail={advisorEmail}
          onSent={(message) => feedback.setSuccess(message)}
        />
      ) : null}
    </section>
  )
}
