'use client'

import dynamic from 'next/dynamic'

import { Skeleton } from '@/components/ui/skeleton'

export const RevenueChartLazy = dynamic(
  () => import('./revenue-chart').then((m) => m.RevenueChart),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> },
)
