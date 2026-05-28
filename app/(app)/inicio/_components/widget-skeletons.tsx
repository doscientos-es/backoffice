import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const KPI_SKELETON_KEYS = ["kpi-a", "kpi-b", "kpi-c", "kpi-d", "kpi-e", "kpi-f"] as const;
const AVISOS_SKELETON_KEYS = ["aviso-a", "aviso-b", "aviso-c", "aviso-d"] as const;

export function KpiGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
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
