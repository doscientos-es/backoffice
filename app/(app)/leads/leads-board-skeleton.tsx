import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder for the kanban columns while the leads are being fetched. */
export function LeadsBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" role="status" aria-label="Cargando leads">
      {Array.from({ length: 4 }).map((_, col) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton columns, order never changes
        <div key={col} className="flex w-64 shrink-0 flex-col gap-3">
          <Skeleton className="h-6 w-28 rounded" />
          {Array.from({ length: 3 }).map((_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows, order never changes
            <Skeleton key={row} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}
