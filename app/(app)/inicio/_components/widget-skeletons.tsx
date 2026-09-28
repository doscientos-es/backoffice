import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const KPI_SKELETON_KEYS = ["kpi-a", "kpi-b", "kpi-c", "kpi-d"] as const;
const AVISOS_SKELETON_KEYS = ["aviso-a", "aviso-b", "aviso-c", "aviso-d"] as const;
const MY_DAY_SKELETON_KEYS = ["my-day-a", "my-day-b", "my-day-c"] as const;
const MY_DAY_ROW_KEYS = ["row-a", "row-b", "row-c"] as const;

export function MyDayWidgetSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {MY_DAY_SKELETON_KEYS.map((key) => (
        <Card key={key} className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {MY_DAY_ROW_KEYS.map((row) => (
              <div key={row} className="flex items-center gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KpiGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_SKELETON_KEYS.map((key) => (
        <Card key={key}>
          <CardContent className="flex items-start justify-between gap-3 pt-5">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="size-9 rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AvisosWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {AVISOS_SKELETON_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-3">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RangeSelectorSkeleton() {
  return (
    <div className="inline-flex h-8 items-center gap-1 rounded-lg border bg-card p-0.5">
      {[28, 32, 32, 36].map((w) => (
        <Skeleton key={w} className="rounded-md" style={{ height: 24, width: w }} />
      ))}
    </div>
  );
}

export function RevenueWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}
