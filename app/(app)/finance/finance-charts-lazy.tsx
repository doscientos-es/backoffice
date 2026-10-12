'use client'

import dynamic from 'next/dynamic'

import { Skeleton } from '@/components/ui/skeleton'

export const FinanceChartLazy = dynamic(
  () => import('./finance-chart').then((m) => m.FinanceChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
)

export const FinanceCategoryChartLazy = dynamic(
  () => import('./finance-category-chart').then((m) => m.FinanceCategoryChart),
  { ssr: false, loading: () => <Skeleton className="mx-6 h-44 w-44 rounded-full" /> },
)
