import { Skeleton } from '@/components/ui/skeleton'

export default function EmailMarketingLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Cargando email marketing">
      <span className="sr-only">Cargando email marketing…</span>
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-4 rounded-xl border p-5" aria-hidden="true">
        <Skeleton className="h-5 w-44" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {['uno', 'dos', 'tres', 'cuatro', 'cinco'].map((key) => (
            <Skeleton key={key} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {['uno', 'dos', 'tres'].map((key) => (
          <Skeleton key={key} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
