'use client'

import dynamic from 'next/dynamic'

import { Skeleton } from '@/components/ui/skeleton'

export const InsightsChartLazy = dynamic(
  () => import('./insights-chart').then((m) => m.InsightsChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
)
