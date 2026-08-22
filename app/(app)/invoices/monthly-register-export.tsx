"use client";

import { CalendarDays, ChevronDown, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Groups the monthly and annual accounting-register downloads. */
export function InvoiceRegisterExport({ year }: { year: number }) {
  const [month, setMonth] = useState(currentMonth);
  const monthHref = `/api/invoices/libro-registro?month=${month}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2">
          <Download className="size-4" />
          Libro registro
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
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
    </Popover>
  );
}
