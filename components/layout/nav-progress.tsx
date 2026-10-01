'use client'

/**
 * Barra de progreso fina (estilo NProgress) para navegaciones cliente en
 * Next.js App Router.
 *
 * Estrategia:
 * - Un listener de `click` en el documento detecta cuándo el usuario activa
 *   un <a> interno que cambia de URL → arranca la barra.
 * - Las navegaciones programáticas (`router.push/replace`) la arrancan con
 *   `startNavProgress()`.
 * - El cambio de pathname o query detecta el final → completa la barra.
 * - Un tope de seguridad la cierra si la navegación nunca llega a producirse.
 */

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const START_EVENT = 'nav-progress:start'
const MAX_DURATION_MS = 10_000

function currentUrlKey(): string {
  return `${window.location.pathname}${window.location.search}`
}

/** Arranca la barra para navegaciones programáticas hacia `href` (si cambia la URL). */
export function startNavProgress(href?: string) {
  if (typeof window === 'undefined') return
  if (href) {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return
    if (`${url.pathname}${url.search}` === currentUrlKey()) return
  }
  window.dispatchEvent(new Event(START_EVENT))
}

function shouldTrackAnchorClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  const anchor = (event.target as Element | null)?.closest?.('a')
  if (!anchor || anchor.hasAttribute('download')) return false
  if (anchor.target && anchor.target !== '_self') return false
  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#')) return false
  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin) return false
  return `${url.pathname}${url.search}` !== currentUrlKey()
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressBar />
    </Suspense>
  )
}

function NavProgressBar() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const urlKey = `${pathname}?${search}`
  const [active, setActive] = useState(false)
  const [width, setWidth] = useState(0)
  const prevKey = useRef(urlKey)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishRef = useRef<() => void>(() => {})

  finishRef.current = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    intervalRef.current = null
    if (!active) return
    setWidth(100)
    doneTimerRef.current = setTimeout(() => {
      setActive(false)
      setWidth(0)
    }, 300)
  }

  // Cuando la URL cambia → la navegación terminó.
  useEffect(() => {
    if (prevKey.current === urlKey) return
    prevKey.current = urlKey
    finishRef.current()
  }, [urlKey])

  useEffect(() => {
    function startProgress() {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
      setActive(true)
      setWidth(8)

      let w = 8
      intervalRef.current = setInterval(() => {
        // Easing asintótico: nunca llega al 90% sola.
        w = w + (90 - w) * 0.08
        setWidth(Math.min(w, 88))
      }, 120)
      safetyTimerRef.current = setTimeout(() => finishRef.current(), MAX_DURATION_MS)
    }

    function handleClick(e: MouseEvent) {
      if (shouldTrackAnchorClick(e)) startProgress()
    }

    document.addEventListener('click', handleClick)
    window.addEventListener(START_EVENT, startProgress)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener(START_EVENT, startProgress)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    }
  }, [])

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed top-0 left-0 z-9999 h-0.5 bg-primary ease-linear',
        active
          ? 'opacity-100 transition-[width] duration-100'
          : 'opacity-0 transition-opacity duration-300',
      )}
      style={{ width: `${width}%` }}
    />
  )
}
