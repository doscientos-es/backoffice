'use client'

import { Drawer } from '@doscientos/ui'
import { List as Menu, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { Logo } from '@/components/branding'
import { NavigationTree } from '@/components/layout/navigation-tree'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { UserMenu } from '@/components/layout/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { IconButton } from '@/components/ui/icon-button'
import type { CurrentUser } from '@/lib/auth'
import { visibleNavigationGroups } from '@/lib/navigation/navigation'

export function MobileNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const visibleGroups = visibleNavigationGroups(user.role)

  return (
    <div className="app-mobile-nav items-center gap-2">
      <Drawer
        trigger={
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
        }
        isOpen={open}
        onOpenChange={setOpen}
        side="left"
        className="w-64! max-w-[80vw]! bg-card"
        showCloseButton={false}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <Link href="/inicio" onClick={() => setOpen(false)} aria-label="doscientos · Inicio">
              <Logo size="md" />
            </Link>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav links */}
          <nav
            className="no-scrollbar flex flex-1 scroll-fade flex-col overflow-y-auto px-2 py-3"
            aria-label="Navegación principal"
          >
            <NavigationTree
              groups={visibleGroups}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </nav>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t border-border p-2">
            <div className="flex items-center justify-between gap-1">
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <ErrorBoundary fallback={() => null}>
                  <NotificationsBell memberId={user.id} />
                </ErrorBoundary>
                <IconButton
                  asChild
                  variant="ghost"
                  className="border-0"
                  label="Ajustes"
                  aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
                >
                  <Link href="/settings" onClick={() => setOpen(false)}>
                    <Settings className="size-4" aria-hidden />
                  </Link>
                </IconButton>
                <ErrorBoundary fallback={() => null}>
                  <UserMenu user={user} />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
