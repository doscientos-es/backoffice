'use client'

import { ButtonGroup } from '@doscientos/ui'
import { LayoutGrid, List, LoaderCircle as Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/** Params that are meaningful in both views. */
const SHARED_PARAMS = ['q', 'project', 'priority', 'assignee', 'blocked'] as const
/** Params only meaningful in list view. */
const LIST_ONLY_PARAMS = ['status'] as const

export function TasksViewToggle({ view }: { view: 'board' | 'list' }) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function buildHref(target: 'board' | 'list'): string {
    const next = new URLSearchParams(params.toString())
    next.delete('page')
    // The board shows every status; retain list filters and ordering for the return trip.
    if (target === 'board') next.delete('view')
    else next.set('view', 'list')

    const qs = next.toString()
    return qs ? `/tasks?${qs}` : '/tasks'
  }

  const navigate = (target: 'board' | 'list') => {
    if (target === view) return
    startTransition(() => {
      router.push(buildHref(target))
    })
  }

  // Count filters the user has actively set (excluding page / view).
  const activeCount = [...SHARED_PARAMS, ...LIST_ONLY_PARAMS].filter((k) => !!params.get(k)).length

  return (
    <div className="flex items-center gap-2">
      {activeCount > 0 && (
        <Badge
          variant="neutral"
          className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
          title={`${activeCount} filtro${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}`}
        >
          {activeCount}
        </Badge>
      )}
      <ButtonGroup className="rounded-lg border border-border bg-muted/30">
        <Button
          size="sm"
          variant={view === 'board' ? 'secondary' : 'ghost'}
          className={view !== 'board' ? 'text-muted-foreground hover:text-foreground' : ''}
          aria-pressed={view === 'board'}
          disabled={isPending}
          onClick={() => navigate('board')}
        >
          {isPending && view === 'list' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LayoutGrid className="size-3.5" />
          )}
          Tablero
        </Button>
        <Button
          size="sm"
          variant={view === 'list' ? 'secondary' : 'ghost'}
          className={view !== 'list' ? 'text-muted-foreground hover:text-foreground' : ''}
          aria-pressed={view === 'list'}
          disabled={isPending}
          onClick={() => navigate('list')}
        >
          {isPending && view === 'board' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <List className="size-3.5" />
          )}
          Lista
        </Button>
      </ButtonGroup>
    </div>
  )
}
