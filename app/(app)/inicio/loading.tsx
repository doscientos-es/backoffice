import { Skeleton } from "@/components/ui/skeleton";

const KPI_KEYS = ["a", "b", "c", "d"] as const;

export default function InicioLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-24" />
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_KEYS.map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      {/* Charts / panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
