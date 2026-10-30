'use client'

import { type AnchorHTMLAttributes, type ReactNode, useEffect, useState } from 'react'

import { trackPortalEngagement } from '../actions'

type ReportableEngagement = 'pricing_viewed' | 'terms_viewed' | 'whatsapp_click'

/** Reports a signal once per browser session; failures are silent by design. */
function reportOnce(token: string, type: ReportableEngagement) {
  const key = `proposal-engagement:${token}:${type}`
  try {
    if (window.sessionStorage.getItem(key)) return
    window.sessionStorage.setItem(key, '1')
  } catch {
    // Storage blocked: the server still deduplicates.
  }
  void trackPortalEngagement(token, type).catch(() => undefined)
}

/**
 * Tells the team when the lead actually reads the price and the terms: the
 * section must stay mostly on screen for a couple of seconds, so a fast scroll
 * past it does not count.
 */
export function EngagementTracker({ token }: { token: string }) {
  useEffect(() => {
    const targets: Array<[string, ReportableEngagement]> = [
      ['inversion', 'pricing_viewed'],
      ['condiciones', 'terms_viewed'],
    ]
    const timers = new Map<Element, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const type = targets.find(([id]) => id === entry.target.id)?.[1]
          if (!type) continue
          const pending = timers.get(entry.target)
          if (entry.isIntersecting && pending === undefined) {
            timers.set(
              entry.target,
              window.setTimeout(() => {
                reportOnce(token, type)
                observer.unobserve(entry.target)
              }, 2500),
            )
          } else if (!entry.isIntersecting && pending !== undefined) {
            window.clearTimeout(pending)
            timers.delete(entry.target)
          }
        }
      },
      { threshold: 0.5 },
    )
    for (const [id] of targets) {
      const el = document.getElementById(id)
      if (el && el.getClientRects().length > 0) observer.observe(el)
    }
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [token])
  return null
}

/** Link that reports a lead click (e.g. WhatsApp) before following the href. */
export function TrackedLink({
  token,
  type,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { token: string; type: ReportableEngagement }) {
  return (
    // biome-ignore lint/a11y/useAnchorContent: children come through props
    <a
      {...props}
      onClick={(event) => {
        reportOnce(token, type)
        onClick?.(event)
      }}
    />
  )
}

/** Attribute that marks every rendering of the accept/decline panel. */
export const RESPONSE_PANEL_ATTR = 'data-proposal-response'

/**
 * The panel is rendered twice (sidebar on desktop, below the document on
 * mobile) and CSS hides one of them, so pick the one that is actually visible.
 */
function visibleResponsePanel(): HTMLElement | null {
  const panels = document.querySelectorAll<HTMLElement>(`[${RESPONSE_PANEL_ATTR}]`)
  return Array.from(panels).find((panel) => panel.getClientRects().length > 0) ?? null
}

function scrollToResponse() {
  const panel = visibleResponsePanel()
  if (!panel) return
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(
    () => panel.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }),
    450,
  )
}

/** Button that jumps to the accept/decline panel. */
export function RespondButton({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <button type="button" onClick={scrollToResponse} className={className}>
      {children}
    </button>
  )
}

/**
 * Fixed bottom bar for small screens: keeps the price and the main action in
 * reach while reading, and steps aside once the panel itself is on screen.
 */
export function MobileCtaBar({
  totalLabel,
  total,
  cta,
}: {
  totalLabel: string
  total: string
  cta: string
}) {
  const [panelVisible, setPanelVisible] = useState(false)

  useEffect(() => {
    const panels = document.querySelectorAll<HTMLElement>(`[${RESPONSE_PANEL_ATTR}]`)
    const visible = new Set<Element>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }
      setPanelVisible(visible.size > 0)
    })
    for (const panel of panels) observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      aria-hidden={panelVisible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-transform duration-200 lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95 ${panelVisible ? 'pointer-events-none translate-y-full' : 'translate-y-0'}`}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
            {totalLabel}
          </p>
          <p className="truncate text-base font-bold text-zinc-900 dark:text-zinc-100">{total}</p>
        </div>
        <RespondButton className="shrink-0 rounded-full bg-[#2A4227] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1f3320] focus-visible:ring-2 focus-visible:ring-[#2A4227] focus-visible:ring-offset-2 focus-visible:outline-none">
          {cta}
        </RespondButton>
      </div>
    </div>
  )
}

export type NavItem = { id: string; label: string }

/** Sticky index of the document sections; highlights the one being read. */
export function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')

  useEffect(() => {
    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const topmost = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (topmost) setActive(topmost.target.id)
      },
      { rootMargin: '-20% 0px -65% 0px' },
    )
    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  }, [items])

  if (items.length < 2) return null
  return (
    <nav
      aria-label="Secciones"
      className="sticky top-0 z-30 -mx-1 overflow-x-auto border-b border-zinc-200 bg-white/90 px-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90"
    >
      <ul className="flex min-w-max gap-1 py-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? 'true' : undefined}
              className={`block rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active === item.id ? 'bg-[#2A4227] text-white dark:bg-[#9CC196] dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
