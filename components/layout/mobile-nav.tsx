"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/branding";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { CurrentUser } from "@/lib/auth";
import {
  type NavigationGroup,
  type NavigationItem,
  visibleNavigationGroups,
} from "@/lib/navigation/navigation";
import { cn } from "@/lib/utils";
import { version } from "../../package.json";

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:transition-opacity",
        active
          ? "bg-secondary text-foreground font-medium before:opacity-100"
          : "text-muted-foreground before:opacity-0 hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavSection({
  group,
  isActive,
  onNavClick,
}: {
  group: NavigationGroup & { items: NavigationItem[] };
  isActive: (href: string) => boolean;
  onNavClick: () => void;
}) {
  const hasActive = group.items.some((i) => isActive(i.href));
  const fallback = group.defaultOpen ?? true;
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return fallback;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`nav-section-mobile-${group.label}`);
    } catch {
      // Keep the deterministic default when browser storage is unavailable.
    }
    if (hasActive) return true;
    return stored === null ? fallback : stored === "1";
  });

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(`nav-section-mobile-${group.label}`, next ? "1" : "0");
    } catch {
      // The in-memory state remains usable without persistence.
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex w-full items-center justify-between rounded-md px-2.5 py-1 transition-colors hover:bg-secondary/40"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none group-hover:text-muted-foreground transition-colors">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground/40 transition-transform group-hover:text-muted-foreground",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open &&
        group.items.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            onClick={onNavClick}
          />
        ))}
    </div>
  );
}

export function MobileNav({
  user,
  verifactuMode,
  demoMode,
}: {
  user: CurrentUser;
  verifactuMode: string;
  demoMode: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visibleGroups = visibleNavigationGroups(user.role);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    return !visibleGroups.some((g) =>
      g.items.some(
        (i) =>
          i.href !== href &&
          i.href.startsWith(`${href}/`) &&
          (pathname === i.href || pathname.startsWith(`${i.href}/`)),
      ),
    );
  };

  return (
    <div className="flex items-center gap-2 md:hidden">
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
              {visibleGroups.map((group, gi) => (
                <div key={group.label ?? "__home"} className={cn(gi > 0 && "mt-3")}>
                  {group.label ? (
                    <NavSection
                      group={group}
                      isActive={isActive}
                      onNavClick={() => setOpen(false)}
                    />
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {group.items.map(({ href, label, icon }) => (
                        <NavLink
                          key={href}
                          href={href}
                          label={label}
                          icon={icon}
                          active={isActive(href)}
                          onClick={() => setOpen(false)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="flex flex-col border-t border-border p-2 gap-2">
              <div className="flex items-center justify-between gap-1">
                {demoMode ? (
                  <Badge variant="warning" className="h-4 px-1 text-[9px] font-bold uppercase ml-1">
                    MODO DEMO
                  </Badge>
                ) : null}
                <Badge
                  variant={
                    verifactuMode === "PROD"
                      ? "success"
                      : verifactuMode === "TEST"
                        ? "warning"
                        : "neutral"
                  }
                  className="h-4 px-1 text-[9px] font-bold uppercase ml-1"
                >
                  AEAT {verifactuMode}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="px-2 text-xs text-muted-foreground -mr-1">v{version}</span>
                  <ErrorBoundary fallback={() => null}>
                    <NotificationsBell memberId={user.id} />
                  </ErrorBoundary>
                  <ThemeToggle />
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
