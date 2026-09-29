import { FormCardSkeleton } from "@/components/layout/form-card-skeleton";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

export default function NewProposalLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[80, 110]} titleWidth={200} actions={[]} />
      <FormCardSkeleton rows={4} columns={2} withTextarea />
    </div>
  );
}
