'use client'

import { ButtonGroup } from '@doscientos/ui'
import {
  ChartLine as ChartNoAxesCombined,
  LayoutGrid,
  List,
  LoaderCircle as Loader2,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type LeadView = 'board' | 'list' | 'analytics'
const FILTER_KEYS = ['q', 'status', 'source', 'solution', 'assignee', 'attention', 'ids']

export function LeadsViewToggle({ view }: { view: LeadView }) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState<LeadView | null>(null)

  const navigate = (target: LeadView) => {
    if (target === view) return
    setPending(target)
    startTransition(() => {
      if (target === 'analytics') {
        router.push('/leads/analytics')
        setPending(null)
        return
      }
      const next = new URLSearchParams(params.toString())
      next.delete('page')
      if (target === 'list') {
        next.set('view', 'list')
      } else {
        next.delete('view')
      }
      const query = next.toString()
      router.push(query ? `/leads?${query}` : '/leads')
      setPending(null)
    })
  }

  const activeCount = FILTER_KEYS.filter((key) => Boolean(params.get(key))).length

  return (
    <div className="flex items-center gap-2">
      {activeCount > 0 ? (
        <Badge
          variant="neutral"
          className="h-5 px-1.5 text-[11px] tabular-nums"
          title={`${activeCount} filtros activos`}
        >
          {activeCount}
        </Badge>
      ) : null}
      <ButtonGroup
        aria-label="Vista de leads"
        className="rounded-lg border border-border bg-muted/30"
      >
        <Button
          size="sm"
          variant={view === 'board' ? 'secondary' : 'ghost'}
          className={view !== 'board' ? 'text-muted-foreground hover:text-foreground' : ''}
          disabled={pending !== null}
          aria-label="Tablero"
          aria-pressed={view === 'board'}
          onClick={() => navigate('board')}
        >
          {pending === 'board' ? (
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
          disabled={pending !== null}
          aria-label="Lista"
          aria-pressed={view === 'list'}
          onClick={() => navigate('list')}
        >
          {pending === 'list' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <List className="size-3.5" />
          )}
          Lista
        </Button>
        <Button
          size="sm"
          variant={view === 'analytics' ? 'secondary' : 'ghost'}
          className={view !== 'analytics' ? 'text-muted-foreground hover:text-foreground' : ''}
          disabled={pending !== null}
          aria-label="Análisis"
          aria-pressed={view === 'analytics'}
          title="Análisis de leads"
          onClick={() => navigate('analytics')}
        >
          {pending === 'analytics' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ChartNoAxesCombined className="size-3.5" />
          )}
          <span className="hidden sm:inline">Análisis</span>
        </Button>
      </ButtonGroup>
    </div>
  )
}
