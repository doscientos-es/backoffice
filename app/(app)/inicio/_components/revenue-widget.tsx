import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { getRevenueSeries } from '@/lib/dashboard/queries'
import type { DashboardRange } from '@/lib/dashboard/types'

import { RevenueChart } from '../revenue-chart'

export async function RevenueWidget({ range }: { range: DashboardRange }) {
  const data = await getRevenueSeries(range)
  const hasData = [data.billed, data.collected].some((metric) =>
    metric.totals.some((point) => point.current > 0 || point.previous > 0),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturación y cobros</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <RevenueChart data={data} />
        ) : (
          <Empty className="h-56">
            <EmptyHeader>
              <EmptyTitle>Sin actividad financiera en este periodo</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <p className="text-muted-foreground max-w-sm text-center text-sm">
                No hay facturas emitidas ni cobros recibidos. Prueba con un periodo más amplio o
                crea una factura para empezar a ver la evolución.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/inicio?range=90d">Ver últimos 90 días</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/invoices">Emitir primera factura</Link>
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
