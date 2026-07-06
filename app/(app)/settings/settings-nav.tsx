"use client";

import { cn } from "@/lib/utils";
import { Activity, Building2, Mail, Shield, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href:
  | "/settings/profile"
  | "/settings/company"
  | "/settings/team"
  | "/settings/email-templates"
  | "/settings/diagnostics"
  | "/settings/legal";
  label: string;
  icon: typeof User;
  requiresAdmin: boolean;
};

const ITEMS: readonly Item[] = [
  { href: "/settings/profile", label: "Perfil", icon: User, requiresAdmin: false },
  { href: "/settings/company", label: "Empresa", icon: Building2, requiresAdmin: true },
  { href: "/settings/team", label: "Equipo", icon: Users, requiresAdmin: true },
  { href: "/settings/email-templates", label: "Plantillas email", icon: Mail, requiresAdmin: true },
  { href: "/settings/diagnostics", label: "Diagnóstico", icon: Activity, requiresAdmin: true },
  { href: "/settings/legal", label: "Legal / Verifactu", icon: Shield, requiresAdmin: false },
] as const;

export function SettingsNav({ canManageTeam }: { canManageTeam: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.requiresAdmin || canManageTeam);

  return (
    <nav
      aria-label="Ajustes"
      className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 md:sticky md:top-6 md:mx-0 md:w-48 md:self-start md:flex-col md:overflow-visible md:px-0"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm transition-colors",
              "md:before:absolute md:before:left-0 md:before:top-1/2 md:before:h-5 md:before:w-0.5 md:before:-translate-y-1/2 md:before:rounded-r-full md:before:bg-primary md:before:transition-opacity",
              active
                ? "bg-secondary text-foreground font-medium md:before:opacity-100"
                : "text-muted-foreground md:before:opacity-0 hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
