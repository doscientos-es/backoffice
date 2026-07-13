"use client";

import { Logo } from "@/components/branding";
import { CommandPaletteTrigger } from "@/components/layout/command-palette-trigger";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { CurrentUser, MemberRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileSignature,
  FolderKanban,
  Globe,
  Home,
  Images,
  Inbox,
  KeyRound,
  Megaphone,
  Receipt,
  Repeat,
  Settings,
  Share2,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { version } from "../../package.json";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Si se indica, solo los roles listados ven este item. Sin restricción = todos. */
  allowedRoles?: MemberRole[];
};

type NavGroup = {
  /** Etiqueta de sección. undefined = sin cabecera (p.ej. Inicio). */
  label?: string;
  items: NavItem[];
  /** Si false, el grupo empieza colapsado (a menos que haya un item activo). Default: true. */
  defaultOpen?: boolean;
};

const ADMIN_ROLES: MemberRole[] = ["owner", "admin"];

/**
 * Navegación principal agrupada por flujo de negocio.
 * Orden: Inicio → Ventas → Entrega → Finanzas → Growth → Empresa.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/inicio", label: "Inicio", icon: Home },
      { href: "/calendar", label: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Ventas",
    items: [
      { href: "/leads", label: "Leads", icon: Inbox },
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/proposals", label: "Propuestas", icon: FileSignature },
    ],
  },
  {
    label: "Entrega",
    items: [
      { href: "/projects", label: "Proyectos", icon: FolderKanban },
      { href: "/tasks", label: "Tareas", icon: CheckSquare },
      { href: "/webs", label: "Webs", icon: Globe, allowedRoles: ADMIN_ROLES },
    ],
  },
  {
    label: "Finanzas",
    defaultOpen: false,
    items: [
      { href: "/invoices", label: "Facturas", icon: Receipt, allowedRoles: ADMIN_ROLES },
      { href: "/subscriptions", label: "Suscripciones", icon: Repeat, allowedRoles: ADMIN_ROLES },
      { href: "/finance", label: "Finanzas", icon: Wallet, allowedRoles: ADMIN_ROLES },
      {
        href: "/finance/portfolio",
        label: "Portfolio",
        icon: BarChart3,
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
  {
    label: "Growth",
    defaultOpen: false,
    items: [
      { href: "/marketing", label: "Publicidad", icon: Megaphone, allowedRoles: ADMIN_ROLES },
      { href: "/social", label: "Social", icon: Share2, allowedRoles: ADMIN_ROLES },
    ],
  },
  {
    label: "Empresa",
    defaultOpen: false,
    items: [
      { href: "/reminders", label: "Recordatorios", icon: Bell },
      { href: "/internal-docs", label: "Docs internos", icon: Archive },
      { href: "/brand", label: "Marca", icon: Images },
      { href: "/vault", label: "Bóveda", icon: KeyRound, allowedRoles: ADMIN_ROLES },
      { href: "/settings", label: "Ajustes", icon: Settings },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  indented = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  indented?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md text-sm transition-colors",
        "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:transition-opacity",
        indented ? "py-2 pl-9 pr-2.5" : "px-2.5 py-2",
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
}: {
  group: NavGroup & { items: NavItem[] };
  isActive: (href: string) => boolean;
}) {
  const hasActive = group.items.some((i) => isActive(i.href));
  const fallback = group.defaultOpen ?? true;
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return fallback;
    const stored = localStorage.getItem(`nav-section-${group.label}`);
    if (hasActive) return true;
    return stored === null ? fallback : stored === "1";
  });

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`nav-section-${group.label}`, next ? "1" : "0");
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
          <NavLink key={href} href={href} label={label} icon={icon} active={isActive(href)} />
        ))}
    </div>
  );
}

export function Sidebar({ user, verifactuMode }: { user: CurrentUser; verifactuMode: string }) {
  const pathname = usePathname();

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.allowedRoles || item.allowedRoles.includes(user.role)),
  })).filter((g) => g.items.length > 0);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    // Don't activate parent if a more specific sibling item already matches
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
        className="flex flex-1 flex-col overflow-y-auto px-2 py-1 scroll-fade no-scrollbar"
        aria-label="Navegación principal"
      >
        {visibleGroups.map((group, gi) => (
          <div key={group.label ?? "__home"} className={cn(gi > 0 && "mt-3")}>
            {group.label ? (
              <NavSection group={group} isActive={isActive} />
            ) : (
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon }) => (
                  <NavLink
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    active={isActive(href)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <footer className="flex flex-col border-t border-border p-2 gap-2">
        <ErrorBoundary>
          <div className="flex items-center justify-between gap-1">
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
              <NotificationsBell memberId={user.id} />
              <ThemeToggle />
            </div>
          </div>
          <UserMenu user={user} />
        </ErrorBoundary>
      </footer>
    </aside>
  );
}
