'use client'

import { CalendarDays, ChevronDown, Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PopoverContent, PopoverTrigger } from '@doscientos/ui'

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function quarterForMonth(month: string): { year: string; quarter: number; label: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const year = month.slice(0, 4)
  const quarter = Math.ceil(Number(month.slice(5, 7)) / 3)
  return { year, quarter, label: `T${quarter} ${year}` }
}

/** Groups the monthly and annual accounting-register downloads. */
export function InvoiceRegisterExport({ year }: { year: number }) {
  const [month, setMonth] = useState(currentMonth)
  const monthHref = `/api/invoices/libro-registro?month=${month}`
  const quarter = quarterForMonth(month)
  const quarterHref = quarter
    ? `/api/invoices/trimestral?year=${quarter.year}&quarter=${quarter.quarter}`
    : null

  return (
    <PopoverTrigger>
        <Button variant="outline" className="h-9 gap-2">
          <Download className="size-4" />
          Libro registro
          <ChevronDown className="text-muted-foreground size-3.5" />
        </Button>
      <PopoverContent placement="bottom end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <div className="mb-4">
          <p className="text-sm font-semibold">Descargar libro registro</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
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

          <div className="border-border space-y-2 border-t pt-4">
            <label htmlFor="invoice-quarterly-month" className="text-xs font-medium">
              Carpeta trimestral para asesoría
            </label>
            <p className="text-muted-foreground text-xs">
              ZIP con gastos, cobros y sus metadatos del trimestre seleccionado.
            </p>
            <div className="flex gap-2">
              <Input
                id="invoice-quarterly-month"
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(event) => setMonth(event.target.value)}
                className="h-9 min-w-0 flex-1"
              />
              {quarterHref && quarter ? (
                <Button variant="secondary" className="h-9" asChild>
                  <a
                    href={quarterHref}
                    download={`doscientos-T${quarter.quarter}-${quarter.year}.zip`}
                  >
                    Descargar ZIP
                  </a>
                </Button>
              ) : (
                <Button variant="secondary" className="h-9" disabled>
                  Descargar ZIP
                </Button>
              )}
            </div>
            {quarter ? (
              <p className="text-muted-foreground text-xs">Se descargará {quarter.label}.</p>
            ) : null}
          </div>

          <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <CalendarDays className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">Año completo {year}</p>
                <p className="text-muted-foreground text-xs">Todas las facturas del ejercicio</p>
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
