import { FormCardSkeleton } from '@/components/layout/form-card-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'

export default function NewTaskLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[60, 100]} titleWidth={180} actions={[]} />
      <FormCardSkeleton rows={6} columns={2} withTextarea />
    </div>
  )
}
