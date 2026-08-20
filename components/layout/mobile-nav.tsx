"use client";

import { List as Menu, Gear as Settings, XIcon as X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/branding";
import { NavigationTree } from "@/components/layout/navigation-tree";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { CurrentUser } from "@/lib/auth";
import { visibleNavigationGroups } from "@/lib/navigation/navigation";
import { version } from "../../package.json";

export function MobileNav({ user, demoMode }: { user: CurrentUser; demoMode: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visibleGroups = visibleNavigationGroups(user.role);

  return (
    <div className="flex items-center gap-2 lg:hidden">
      <Drawer direction="left" open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menú"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="bg-card w-64! max-w-[80vw]!">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <Link href="/inicio" onClick={() => setOpen(false)} aria-label="doscientos · Inicio">
                <Logo size="md" />
              </Link>
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>

            {/* Nav links */}
            <nav
              className="flex flex-1 flex-col px-2 py-3 overflow-y-auto scroll-fade no-scrollbar"
              aria-label="Navegación principal"
            >
              <NavigationTree
                groups={visibleGroups}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </nav>

            {/* Footer */}
            <div className="flex flex-col border-t border-border p-2 gap-2">
              <div className="flex items-center justify-between gap-1">
                {demoMode ? (
                  <Badge variant="warning" className="h-4 px-1 text-[9px] font-bold uppercase ml-1">
                    MODO DEMO
                  </Badge>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                  <span className="px-2 text-xs text-muted-foreground -mr-1">v{version}</span>
                  <ThemeToggle />
                  <ErrorBoundary fallback={() => null}>
                    <NotificationsBell memberId={user.id} />
                  </ErrorBoundary>
                  <Link
                    href="/settings"
                    aria-label="Ajustes"
                    aria-current={pathname.startsWith("/settings") ? "page" : undefined}
                    title="Ajustes"
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-secondary aria-[current=page]:text-foreground"
                  >
                    <Settings className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
              <ErrorBoundary fallback={() => null}>
                <UserMenu user={user} />
              </ErrorBoundary>
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
  );
}
