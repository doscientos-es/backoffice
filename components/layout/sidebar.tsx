"use client";

import { Logo } from "@/components/branding";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckSquare,
  FileSignature,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { version } from "../../package.json";

const NAV = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/proposals", label: "Propuestas", icon: FileSignature },
  { href: "/invoices", label: "Facturas", icon: Receipt },
  { href: "/finance", label: "Finanzas", icon: Wallet },
  { href: "/tasks", label: "Tareas", icon: CheckSquare },
  { href: "/reminders", label: "Avisos", icon: Bell },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

export function Sidebar({ user }: { user: CurrentUser; verifactuMode: string }) {
  const pathname = usePathname();
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
      <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Navegación principal">
        {NAV.map(({ href, label, icon: Icon }) => {
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
      </nav>

      <footer className="flex flex-col border-t border-border p-2 gap-2">
        <ErrorBoundary>
          <div className="flex items-center justify-end gap-1">
            <span className="px-2 text-xs text-muted-foreground -mr-1">
              v{version}
            </span>
            <NotificationsBell memberId={user.id} />
            <ThemeToggle />
          </div>
          <UserMenu user={user} />
        </ErrorBoundary>
      </footer>
    </aside>
  );
}
