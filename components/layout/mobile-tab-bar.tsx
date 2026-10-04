'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { CurrentUser } from '@/lib/auth'
import { visibleNavigationGroups } from '@/lib/navigation/navigation'

const PRIMARY_ROUTES = ['/inicio', '/calendar', '/tasks', '/leads', '/reminders']

/** Persistent, thumb-reachable destinations for the authenticated phone layout. */
export function MobileTabBar({ user }: { user: CurrentUser }) {
  const pathname = usePathname()
  const availableItems = visibleNavigationGroups(user.role).flatMap((group) => group.items)
  const tabs = PRIMARY_ROUTES.map((href) => availableItems.find((item) => item.href === href))
    .filter((item) => item !== undefined)
    .slice(0, 4)

  return (
    <nav className="app-mobile-tabbar" aria-label="Secciones principales">
      {tabs.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            className="app-mobile-tab"
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
