'use client'

import { type ComponentProps, lazy, Suspense, useEffect, useState } from 'react'

const QuickView = lazy(() =>
  import('./lead-quick-view').then((module) => ({ default: module.LeadQuickView })),
)

/** Download the drawer and its forms on first open, then retain closing animations. */
export function LeadQuickView(props: ComponentProps<typeof QuickView>) {
  const [hasOpened, setHasOpened] = useState(false)
  const isOpen = props.lead !== null
  useEffect(() => {
    if (isOpen) setHasOpened(true)
  }, [isOpen])

  if (!isOpen && !hasOpened) return null

  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="fixed right-4 bottom-24 z-50 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg md:bottom-4"
        >
          Abriendo ficha…
        </div>
      }
    >
      <QuickView {...props} />
    </Suspense>
  )
}
