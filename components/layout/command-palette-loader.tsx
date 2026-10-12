'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { OPEN_COMMAND_PALETTE_EVENT } from '@/components/layout/command-palette-trigger'
import type { MemberRole } from '@/lib/auth'

const CommandPalette = dynamic(() => import('./command-palette').then((m) => m.CommandPalette), {
  ssr: false,
})

/** Downloads the command palette on first use (⌘K or trigger) and opens it. */
export function CommandPaletteLoader({ role }: { role: MemberRole }) {
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (requested) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setRequested(true)
      }
    }
    const onOpen = () => setRequested(true)
    document.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    }
  }, [requested])

  return requested ? <CommandPalette role={role} initialOpen /> : null
}
