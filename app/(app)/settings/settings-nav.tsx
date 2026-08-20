"use client";

import {
  ActivityIcon as Activity,
  Buildings as Building2,
  Database as DatabaseBackup,
  Envelope as Mail,
  Plug as PlugZap,
  ShieldIcon as Shield,
  TargetIcon as Target,
  UserIcon as User,
  UsersIcon as Users,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: typeof User;
  requiresAdmin: boolean;
};

const ITEMS: readonly Item[] = [
  {
    href: "/settings/profile",
    label: "Perfil",
    icon: User,
    requiresAdmin: false,
  },
  {
    href: "/settings/security",
    label: "Seguridad",
    icon: Shield,
    requiresAdmin: false,
  },
  {
    href: "/settings/company",
    label: "Empresa",
    icon: Building2,
    requiresAdmin: true,
  },
  {
    href: "/settings/team",
    label: "Equipo",
    icon: Users,
    requiresAdmin: true,
  },
  {
    href: "/settings/goals",
    label: "Metas",
    icon: Target,
    requiresAdmin: true,
  },
  {
    href: "/settings/integrations",
    label: "Integraciones",
    icon: PlugZap,
    requiresAdmin: true,
  },
  {
    href: "/settings/email-templates",
    label: "Plantillas email",
    icon: Mail,
    requiresAdmin: true,
  },
  {
    href: "/settings/backups",
    label: "Copias",
    icon: DatabaseBackup,
    requiresAdmin: true,
  },
  {
    href: "/settings/diagnostics",
    label: "Diagnóstico",
    icon: Activity,
    requiresAdmin: true,
  },
  {
    href: "/settings/legal",
    label: "Legal / Verifactu",
    icon: Shield,
    requiresAdmin: false,
  },
] as const;

export function SettingsNav({ canManageTeam }: { canManageTeam: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.requiresAdmin || canManageTeam);

  return (
    <nav aria-label="Ajustes" className="w-full overflow-x-auto pb-1 scroll-fade no-scrollbar">
      <div className="flex w-max min-w-full items-center gap-1 rounded-lg border border-border bg-card p-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
