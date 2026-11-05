'use client'

import {
  type AnchorHTMLAttributes,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { trackPortalEngagement } from '../actions'
import { PROPOSAL_ACTION_CLASS } from './primitives'

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
  href,
  className,
  target,
  rel,
  children,
}: {
  token: string
  type: ReportableEngagement
  href: string
  className?: string
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target']
  rel?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={className}
      onClick={() => reportOnce(token, type)}
    >
      {children}
    </a>
  )
}

/** Attribute that marks every rendering of the accept/decline panel. */
const RESPONSE_PANEL_ATTR = 'data-proposal-response'

/** Ignore any hidden panels so shortcuts always reach the visible form. */
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
  tabIndex,
}: {
  children: ReactNode
  className?: string
  tabIndex?: number
}) {
  return (
    <button type="button" onClick={scrollToResponse} className={className} tabIndex={tabIndex}>
      {children}
    </button>
  )
}

/**
 * Keeps the main action in reach while reading and steps aside when the
 * response panel is visible. Small screens also show the investment.
 */
export function FloatingCta({
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
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-transform duration-200 lg:inset-x-auto lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] lg:left-[max(1.5rem,env(safe-area-inset-left))] lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none dark:border-zinc-800 dark:bg-zinc-950/95 dark:lg:bg-transparent ${panelVisible ? 'pointer-events-none translate-y-[calc(100%+2rem)]' : 'translate-y-0'}`}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0 lg:hidden">
          <p className="text-[11px] font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
            {totalLabel}
          </p>
          <p className="truncate text-base font-bold text-zinc-900 dark:text-zinc-100">{total}</p>
        </div>
        <RespondButton
          tabIndex={panelVisible ? -1 : 0}
          className={`shrink-0 px-5 py-2.5 text-sm font-semibold lg:px-6 lg:py-3.5 lg:shadow-lg ${PROPOSAL_ACTION_CLASS}`}
        >
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
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: remeasure the current link when the active section or available items change
  useLayoutEffect(() => {
    const nav = navRef.current
    const list = listRef.current
    if (!nav || !list) return

    const updateIndicator = () => {
      const current = list.querySelector<HTMLAnchorElement>('a[aria-current="true"]')
      if (!current) return
      setIndicator({ left: current.offsetLeft, width: current.offsetWidth })

      const navRect = nav.getBoundingClientRect()
      const currentRect = current.getBoundingClientRect()
      if (currentRect.left < navRect.left) nav.scrollLeft += currentRect.left - navRect.left
      else if (currentRect.right > navRect.right)
        nav.scrollLeft += currentRect.right - navRect.right
    }

    updateIndicator()
    const observer = new ResizeObserver(updateIndicator)
    observer.observe(list)
    for (const link of list.querySelectorAll('a')) observer.observe(link)
    return () => observer.disconnect()
  }, [active, items])

  if (items.length < 2) return null
  return (
    <nav
      ref={navRef}
      aria-label="Secciones"
      className="sticky top-2 z-30 w-fit max-w-full self-center overflow-x-auto rounded-full bg-white/95 backdrop-blur dark:bg-zinc-950/95"
    >
      <ul ref={listRef} className="relative flex w-max gap-1 p-1">
        {indicator ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 left-0 rounded-full bg-[#BDFF7B] motion-safe:transition-[transform,width] motion-safe:duration-[160ms] motion-safe:ease-out"
            style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
          />
        ) : null}
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? 'true' : undefined}
              className={`relative block rounded-full px-4 py-2 text-xs font-semibold ${active === item.id ? `${indicator ? '' : 'bg-[#BDFF7B]'} text-zinc-950` : 'text-zinc-600 hover:bg-[#BDFF7B]/25 dark:text-zinc-300'}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
