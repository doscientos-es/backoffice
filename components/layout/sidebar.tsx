"use client";

import { Logo } from "@/components/branding";
import { CommandPaletteTrigger } from "@/components/layout/command-palette-trigger";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Archive,
  Bell,
  CheckSquare,
  ChevronDown,
  FileSignature,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  Megaphone,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { version } from "../../package.json";

const NAV_PRIMARY = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/proposals", label: "Propuestas", icon: FileSignature },
  { href: "/invoices", label: "Facturas", icon: Receipt },
  { href: "/finance", label: "Finanzas", icon: Wallet },
  { href: "/tasks", label: "Tareas", icon: CheckSquare },
  { href: "/reminders", label: "Avisos", icon: Bell },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

const NAV_SECONDARY = [
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/internal-docs", label: "Docs internos", icon: Archive },
] as const;

export function Sidebar({ user }: { user: CurrentUser; verifactuMode: string }) {
  const pathname = usePathname();
  const hasSecondaryActive = NAV_SECONDARY.some(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  const [moreOpen, setMoreOpen] = useState(hasSecondaryActive);

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:flex md:flex-col">
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
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1"
        aria-label="Navegación principal"
      >
        {NAV_PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
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
        })}

        {/* Low-frequency section */}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className={cn(
            "group relative mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
            "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            hasSecondaryActive && !moreOpen && "text-foreground",
          )}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              moreOpen ? "rotate-0" : "-rotate-90",
            )}
          />
          <span className="truncate">Más</span>
        </button>
        {moreOpen &&
          NAV_SECONDARY.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md py-2 pl-9 pr-2.5 text-sm transition-colors",
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
          })}
      </nav>

      <footer className="flex flex-col border-t border-border p-2 gap-2">
        <ErrorBoundary>
          <div className="flex items-center justify-end gap-1">
            <span className="px-2 text-xs text-muted-foreground -mr-1">v{version}</span>
            <NotificationsBell memberId={user.id} />
            <ThemeToggle />
          </div>
          <UserMenu user={user} />
        </ErrorBoundary>
      </footer>
    </aside>
  );
}
