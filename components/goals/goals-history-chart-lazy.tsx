'use client'

import dynamic from 'next/dynamic'

import { Skeleton } from '@/components/ui/skeleton'

export const GoalsHistoryChartLazy = dynamic(
  () => import('./goals-history-chart').then((m) => m.GoalsHistoryChart),
  { ssr: false, loading: () => <Skeleton className="h-44 w-full" /> },
)
