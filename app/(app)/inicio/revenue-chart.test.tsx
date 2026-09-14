import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { RevenueChartData } from '@/lib/dashboard/types'

import { RevenueChart } from './revenue-chart'

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

const data: RevenueChartData = {
  totals: [{ month: 'jun', current: 300, previous: 100 }],
  byProject: {
    points: [{ month: 'jun', total: 300, series_0: 300 }],
    series: [{ key: 'series_0', label: 'Web corporativa' }],
  },
  byLead: {
    points: [{ month: 'jun', total: 300, series_0: 300 }],
    series: [{ key: 'series_0', label: 'Marta López' }],
  },
}

describe('RevenueChart', () => {
  it('switches from the yearly comparison to stacked project bars', () => {
    render(<RevenueChart data={data} />)

    expect(screen.getByTestId('bar-current')).toBeTruthy()
    expect(screen.getByTestId('bar-previous')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Por proyecto' }))

    expect(screen.getByRole('tab', { name: 'Por proyecto' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('bar-series_0').getAttribute('data-stack')).toBe('revenue')
    expect(screen.queryByTestId('bar-current')).toBeNull()
  })
})