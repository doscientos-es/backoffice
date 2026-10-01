'use client'

import { Button as PopoverButton, PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { CalendarDays, ChevronDown, Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

type QuarterScope = 'all' | 'income' | 'expenses'

const SCOPE_OPTIONS: { value: QuarterScope; label: string }[] = [
  { value: 'all', label: 'Todo (ingresos y gastos)' },
  { value: 'income', label: 'Solo ingresos' },
  { value: 'expenses', label: 'Solo gastos' },
]

const selectClass =
  'h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Quarters that already started in `year` (all four for past years). */
function availableQuarters(year: number): number[] {
  const now = new Date()
  const last = year === now.getFullYear() ? Math.ceil((now.getMonth() + 1) / 3) : 4
  return Array.from({ length: last }, (_, index) => index + 1)
}

/** Groups the monthly, quarterly and annual accounting-register downloads. */
export function InvoiceRegisterExport({ year }: { year: number }) {
  const [month, setMonth] = useState(currentMonth)
  const monthHref = `/api/invoices/libro-registro?month=${month}`
  const quarters = availableQuarters(year)
  const [quarter, setQuarter] = useState(quarters[quarters.length - 1] ?? 1)
  const [scope, setScope] = useState<QuarterScope>('all')
  const quarterHref = `/api/invoices/trimestral?year=${year}&quarter=${quarter}&scope=${scope}`
  const scopeSuffix = scope === 'all' ? '' : `-${scope === 'income' ? 'ingresos' : 'gastos'}`

  return (
    <PopoverTrigger>
      <PopoverButton type="button" variant="outline" className="h-9 gap-2">
        <Download className="size-4" />
        Libro registro
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverButton>
      <PopoverContent placement="bottom end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <div className="mb-4">
          <p className="text-sm font-semibold">Descargar libro registro</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Exportación contable en CSV por periodo.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="invoice-register-month" className="text-xs font-medium">
              Por mes
            </label>
            <div className="flex gap-2">
              <Input
                id="invoice-register-month"
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(event) => setMonth(event.target.value)}
                className="h-9 min-w-0 flex-1"
              />
              {month ? (
                <Button variant="secondary" className="h-9" asChild>
                  <a href={monthHref} download={`facturas-${month}.csv`}>
                    Descargar
                  </a>
                </Button>
              ) : (
                <Button variant="secondary" className="h-9" disabled>
                  Descargar
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <label htmlFor="invoice-quarterly-month" className="text-xs font-medium">
              Resumen trimestral para asesoría
            </label>
            <p className="text-xs text-muted-foreground">
              Elige trimestre y qué incluir. El envío por email a la gestoría está en Finanzas.
            </p>
            <div className="flex gap-2">
              <select
                id="invoice-quarterly-month"
                aria-label="Trimestre"
                value={quarter}
                onChange={(event) => setQuarter(Number(event.target.value))}
                className={selectClass}
              >
                {quarters.map((q) => (
                  <option key={q} value={q}>
                    T{q} {year}
                  </option>
                ))}
              </select>
              <select
                aria-label="Contenido"
                value={scope}
                onChange={(event) => setScope(event.target.value as QuarterScope)}
                className={selectClass}
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" className="h-9 w-full" asChild>
              <a href={quarterHref} download={`doscientos-T${quarter}-${year}${scopeSuffix}.csv`}>
                Descargar CSV
              </a>
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">Año completo {year}</p>
                <p className="text-xs text-muted-foreground">Todas las facturas del ejercicio</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`/api/invoices/libro-registro?year=${year}`}
                download={`facturas-${year}.csv`}
              >
                Descargar
              </a>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </PopoverTrigger>
  )
}
