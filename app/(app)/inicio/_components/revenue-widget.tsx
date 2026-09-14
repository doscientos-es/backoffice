import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { getRevenueSeries } from '@/lib/dashboard/queries'
import type { DashboardRange } from '@/lib/dashboard/types'
import { describeRange } from '@/lib/utils/date'

import { RevenueChart } from '../revenue-chart'

export async function RevenueWidget({ range }: { range: DashboardRange }) {
  const data = await getRevenueSeries(range)
  const hasData = data.totals.some((p) => p.current > 0 || p.previous > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos · {describeRange(range)}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <RevenueChart data={data} />
        ) : (
          <Empty className="h-56">
            <EmptyHeader>
              <EmptyTitle>Aún no hay ingresos</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <Link href="/invoices">Emitir primera factura</Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
