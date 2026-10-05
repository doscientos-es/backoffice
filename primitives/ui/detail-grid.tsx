import type { ReactNode } from 'react'

import { cn } from '../lib/utils'

export function DetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        'grid min-w-0 grid-cols-1 gap-y-0.5 text-sm sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2.5',
        className,
      )}
    >
      {children}
    </dl>
  )
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 pb-2.5 wrap-break-word text-primary sm:pb-0">{children ?? '—'}</dd>
    </>
  )
}
