import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { RevenueChartData } from '@/lib/dashboard/types'

import { filterZeroRevenueTooltipEntries, RevenueChart } from './revenue-chart'

vi.mock('recharts', () => ({
  Bar: ({ dataKey, stackId }: { dataKey: string; stackId?: string }) => (
    <div data-testid={`bar-${dataKey}`} data-stack={stackId} />
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const billed = {
  totals: [{ month: 'jun', current: 300, previous: 100 }],
  byProject: {
    points: [{ month: 'jun', total: 300, series_web: 300 }],
    series: [{ key: 'series_web', label: 'Web corporativa', href: '/projects/web' }],
  },
  byLead: {
    points: [{ month: 'jun', total: 300, series_marta: 300 }],
    series: [{ key: 'series_marta', label: 'Marta López', href: '/leads/marta' }],
  },
}

const data: RevenueChartData = {
  billed,
  collected: {
    ...billed,
    totals: [{ month: 'jun', current: 150, previous: 50 }],
  },
}

describe('RevenueChart', () => {
  it('removes zero-value series from breakdown tooltips', () => {
    expect(
      filterZeroRevenueTooltipEntries([
        { dataKey: 'series_0', value: 300 },
        { dataKey: 'series_1', value: 0 },
        { dataKey: 'series_2', value: '0' },
      ]),
    ).toEqual([{ dataKey: 'series_0', value: 300 }])
  })

  it('switches from the yearly comparison to stacked project bars', () => {
    render(<RevenueChart data={data} />)

    expect(screen.getByTestId('bar-current')).toBeTruthy()
    expect(screen.getByTestId('bar-previous')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Por proyecto' }))

    expect(screen.getByRole('tab', { name: 'Por proyecto' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.getByTestId('bar-series_web').getAttribute('data-stack')).toBe('revenue')
    expect(screen.queryByTestId('bar-current')).toBeNull()
  })

  it('switches between billed and collected metrics', () => {
    render(<RevenueChart data={data} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Cobros recibidos' }))

    expect(
      screen.getByRole('tab', { name: 'Cobros recibidos' }).getAttribute('aria-selected'),
    ).toBe('true')
  })
})
