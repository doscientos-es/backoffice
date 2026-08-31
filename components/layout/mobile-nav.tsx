'use client'

import { List as Menu, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { Logo } from '@/components/branding'
import { NavigationTree } from '@/components/layout/navigation-tree'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { UserMenu } from '@/components/layout/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { IconButton } from '@/components/ui/icon-button'
import type { CurrentUser } from '@/lib/auth'
import { visibleNavigationGroups } from '@/lib/navigation/navigation'

export function MobileNav({ user, demoMode }: { user: CurrentUser; demoMode: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const visibleGroups = visibleNavigationGroups(user.role)

  return (
    <div className="app-mobile-nav items-center gap-2">
      <Drawer direction="left" open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menú"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="bg-card w-64! max-w-[80vw]!">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-border flex items-center justify-between border-b px-4 py-4">
              <Link href="/inicio" onClick={() => setOpen(false)} aria-label="doscientos · Inicio">
                <Logo size="md" />
              </Link>
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  className="text-muted-foreground hover:bg-secondary hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>

            {/* Nav links */}
            <nav
              className="scroll-fade no-scrollbar flex flex-1 flex-col overflow-y-auto px-2 py-3"
              aria-label="Navegación principal"
            >
              <NavigationTree
                groups={visibleGroups}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </nav>

            {/* Footer */}
            <div className="border-border flex flex-col gap-2 border-t p-2">
              <div className="flex items-center justify-between gap-1">
                {demoMode ? (
                  <Badge variant="warning" className="ml-1 h-4 px-1 text-[9px] font-bold uppercase">
                    MODO DEMO
                  </Badge>
                ) : null}
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
        </DrawerContent>
      </Drawer>
      {demoMode ? (
        <Badge variant="warning" className="h-4 px-1 text-[9px] font-bold uppercase">
          MODO DEMO
        </Badge>
      ) : null}
    </div>
  )
}
