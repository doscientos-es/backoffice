'use client'

import { type ReactNode, Suspense, useState } from 'react'

import { ErrorBoundary } from './error-boundary'

/** Load on first use, then keep mounted so drawers can finish closing. */
export function DeferredContent({ active, children }: { active: boolean; children: ReactNode }) {
  const [hasOpened, setHasOpened] = useState(active)
  if (active && !hasOpened) setHasOpened(true)

  if (!active && !hasOpened) return null

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          active ? (
            <output className="fixed right-4 bottom-24 z-50 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg md:bottom-4">
              Abriendo ficha…
            </output>
          ) : null
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
