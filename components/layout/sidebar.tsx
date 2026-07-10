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
  CheckSquare,
  ChevronDown,
  FileSignature,
  FolderKanban,
  Globe,
  Home,
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
};

const ADMIN_ROLES: MemberRole[] = ["owner", "admin"];

/**
 * Navegación principal agrupada por flujo de negocio.
 * Orden: Inicio → Ventas → Entrega → Finanzas → Growth → Empresa.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/inicio", label: "Inicio", icon: Home }],
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
    items: [
      // "Anuncios" → "Publicidad" para evitar colisión con "Avisos/Recordatorios"
      { href: "/marketing", label: "Publicidad", icon: Megaphone, allowedRoles: ADMIN_ROLES },
      { href: "/social", label: "Social", icon: Share2, allowedRoles: ADMIN_ROLES },
    ],
  },
  {
    label: "Empresa",
    items: [
      { href: "/internal-docs", label: "Docs internos", icon: Archive },
      { href: "/settings", label: "Ajustes", icon: Settings },
    ],
  },
];

/**
 * Sección "Más" — herramientas de uso poco frecuente.
 * "Avisos" → "Recordatorios" elimina la colisión con "Publicidad" (Anuncios).
 * "Documentos" (browser de adjuntos genérico) se ha retirado: los adjuntos
 * son accesibles desde la entidad a la que pertenecen (proyecto, cliente, etc.).
 */
const NAV_MORE: NavItem[] = [
  { href: "/vault", label: "Bóveda", icon: KeyRound, allowedRoles: ADMIN_ROLES },
  { href: "/reminders", label: "Recordatorios", icon: Bell },
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

export function Sidebar({ user, verifactuMode }: { user: CurrentUser; verifactuMode: string }) {
  const pathname = usePathname();

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.allowedRoles || item.allowedRoles.includes(user.role)),
  })).filter((g) => g.items.length > 0);

  const visibleMore = NAV_MORE.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(user.role),
  );

  const hasMoreActive = visibleMore.some(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  const [moreOpen, setMoreOpen] = useState(hasMoreActive);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
          <div
            key={group.label ?? "__home"}
            className={cn("flex flex-col gap-0.5", gi > 0 && "mt-3")}
          >
            {group.label && (
              <p className="px-2.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {group.label}
              </p>
            )}
            {group.items.map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={label} icon={icon} active={isActive(href)} />
            ))}
          </div>
        ))}

        {/* Herramientas de uso poco frecuente */}
        {visibleMore.length > 0 && (
          <div className="mt-3 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                hasMoreActive && !moreOpen && "text-foreground",
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
              visibleMore.map(({ href, label, icon }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={isActive(href)}
                  indented
                />
              ))}
          </div>
        )}
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
