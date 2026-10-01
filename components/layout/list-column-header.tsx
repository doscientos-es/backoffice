'use client'

import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { ListColumn } from './list-page'
import { startNavProgress } from './nav-progress'

export function ListColumnHeader({ column }: { column: ListColumn }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const sortKey = column.sortKey
  if (!sortKey) return column.label
  const active = params.get('sort') === column.sortKey
  const ascending = active && (params.get('dir') ?? 'asc') === 'asc'
  const Icon = active ? (ascending ? ArrowUp : ArrowDown) : ArrowDownUp
  return (
    <button
      type="button"
      onClick={() => {
        const next = new URLSearchParams(params.toString())
        next.set('sort', sortKey)
        next.set('dir', ascending ? 'desc' : 'asc')
        next.delete('page')
        startNavProgress()
        router.replace(`${pathname}?${next}`, { scroll: false })
      }}
      className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground"
    >
      {column.label}
      <Icon className={active ? 'size-3 text-primary' : 'size-3 opacity-40'} />
    </button>
  )
}
