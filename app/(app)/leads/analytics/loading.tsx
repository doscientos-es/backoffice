import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function LeadAnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[60, 90]} titleWidth={200} actions={[160]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  )
}
