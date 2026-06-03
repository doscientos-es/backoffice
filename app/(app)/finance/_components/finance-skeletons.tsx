import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const KPI_KEYS = ["kpi-a", "kpi-b", "kpi-c", "kpi-d"] as const;
const LIST_ROW_KEYS = ["row-a", "row-b", "row-c", "row-d", "row-e"] as const;

export function KpisSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_KEYS.map((key) => (
        <Card key={key}>
          <CardContent className="flex items-start justify-between gap-3 pt-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-7 w-24 rounded" />
            </div>
            <Skeleton className="size-9 rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-56 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44 rounded" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-6">
        {LIST_ROW_KEYS.slice(0, rows).map((key) => (
          <div key={key} className="flex items-center justify-between">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DetailsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <ListCardSkeleton />
        <ListCardSkeleton />
      </div>
      <ListCardSkeleton />
    </div>
  );
}
