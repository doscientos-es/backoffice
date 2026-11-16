'use client'

import { LoaderCircle } from 'lucide-react'
import { useLinkStatus } from 'next/link'

/** Shows immediate feedback until the destination or its loading state is ready. */
export function NavigationPendingIndicator() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle
        aria-hidden="true"
        className="size-3.5 animate-spin motion-reduce:animate-none"
      />
      <span className="sr-only">Cargando sección</span>
    </span>
  )
}
