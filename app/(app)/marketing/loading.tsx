import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton
        breadcrumbs={[]}
        titleWidth={180}
        withDescription
        actions={[120]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-32 rounded" />
                <Skeleton className="h-6 w-24 rounded" />
              </div>
              <Skeleton className="size-9 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40 rounded" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex gap-4 border-b border-border/60 pb-2">
            {[180, 100, 80, 80, 100].map((w, i) => (
              <Skeleton key={`${w}-${i}`} className="h-3 rounded" style={{ width: w }} />
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 py-1.5">
              {[180, 100, 80, 80, 100].map((w, j) => (
                <Skeleton key={`${w}-${j}`} className="h-4 rounded" style={{ width: w }} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
