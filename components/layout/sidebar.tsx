"use client";

import { Settings as Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/branding";
import { CommandPaletteTrigger } from "@/components/layout/command-palette-trigger";
import { NavigationTree } from "@/components/layout/navigation-tree";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { IconButton } from "@/components/ui/icon-button";
import type { CurrentUser } from "@/lib/auth";
import { visibleNavigationGroups } from "@/lib/navigation/navigation";
import { version } from "../../package.json";

export function Sidebar({ user, demoMode }: { user: CurrentUser; demoMode: boolean }) {
  const pathname = usePathname();

  const visibleGroups = visibleNavigationGroups(user.role);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-4 py-5">
        <Link
          href="/inicio"
          aria-label="doscientos · Inicio"
          className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <Logo size="md" />
        </Link>
      </div>
      <div className="px-2 pb-2">
        <CommandPaletteTrigger />
      </div>
      <nav
        className="flex flex-1 flex-col overflow-y-auto px-2 py-1 scroll-fade no-scrollbar"
        aria-label="Navegación principal"
      >
        <NavigationTree groups={visibleGroups} pathname={pathname} />
      </nav>

      <footer className="flex flex-col border-t border-border p-2 gap-2">
        <ErrorBoundary>
          <div className="flex items-center justify-between gap-1">
            {demoMode ? (
              <Badge variant="warning" className="h-4 px-1 text-[9px] font-bold uppercase ml-1">
                MODO DEMO
              </Badge>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <span className="px-2 text-xs text-muted-foreground -mr-1">v{version}</span>
              <ThemeToggle />
              <NotificationsBell memberId={user.id} />
              <IconButton
                asChild
                label="Ajustes"
                aria-current={pathname.startsWith("/settings") ? "page" : undefined}
              >
                <Link href="/settings">
                  <Settings className="size-4" aria-hidden />
                </Link>
              </IconButton>
            </div>
          </div>
          <UserMenu user={user} showSettings={false} />
        </ErrorBoundary>
      </footer>
    </aside>
  );
}
