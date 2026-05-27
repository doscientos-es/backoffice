import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-28" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
