"use client";

import { ActivityIcon as Activity, Buildings as Building2, Database as DatabaseBackup, Envelope as Mail, Plug as PlugZap, ShieldIcon as Shield, TargetIcon as Target, UserIcon as User, UsersIcon as Users } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: typeof User;
  requiresAdmin: boolean;
  section: "Cuenta" | "Organización" | "Sistema" | "Cumplimiento";
};

const ITEMS: readonly Item[] = [
  {
    href: "/settings/profile",
    label: "Perfil",
    icon: User,
    requiresAdmin: false,
    section: "Cuenta",
  },
  {
    href: "/settings/security",
    label: "Seguridad",
    icon: Shield,
    requiresAdmin: false,
    section: "Cuenta",
  },
  {
    href: "/settings/company",
    label: "Empresa",
    icon: Building2,
    requiresAdmin: true,
    section: "Organización",
  },
  {
    href: "/settings/team",
    label: "Equipo",
    icon: Users,
    requiresAdmin: true,
    section: "Organización",
  },
  {
    href: "/settings/goals",
    label: "Metas",
    icon: Target,
    requiresAdmin: true,
    section: "Organización",
  },
  {
    href: "/settings/integrations",
    label: "Integraciones",
    icon: PlugZap,
    requiresAdmin: true,
    section: "Sistema",
  },
  {
    href: "/settings/email-templates",
    label: "Plantillas email",
    icon: Mail,
    requiresAdmin: true,
    section: "Sistema",
  },
  {
    href: "/settings/backups",
    label: "Copias",
    icon: DatabaseBackup,
    requiresAdmin: true,
    section: "Sistema",
  },
  {
    href: "/settings/diagnostics",
    label: "Diagnóstico",
    icon: Activity,
    requiresAdmin: true,
    section: "Sistema",
  },
  {
    href: "/settings/legal",
    label: "Legal / Verifactu",
    icon: Shield,
    requiresAdmin: false,
    section: "Cumplimiento",
  },
] as const;

const SECTIONS = ["Cuenta", "Organización", "Sistema", "Cumplimiento"] as const;

export function SettingsNav({ canManageTeam }: { canManageTeam: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = ITEMS.filter((i) => !i.requiresAdmin || canManageTeam);
  const activeItem =
    items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    items[0]!;

  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="settings-section" className="sr-only">
          Sección de ajustes
        </label>
        <Select
          id="settings-section"
          value={activeItem.href}
          onChange={(event) => router.push(event.target.value)}
          aria-label="Sección de ajustes"
        >
          {SECTIONS.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);
            return sectionItems.length > 0 ? (
              <optgroup key={section} label={section}>
                {sectionItems.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </Select>
      </div>
      <nav
        aria-label="Ajustes"
        className="hidden shrink-0 gap-1 lg:sticky lg:top-6 lg:mx-0 lg:flex lg:w-48 lg:self-start lg:flex-col"
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
                "lg:before:absolute lg:before:left-0 lg:before:top-1/2 lg:before:h-5 lg:before:w-0.5 lg:before:-translate-y-1/2 lg:before:rounded-r-full lg:before:bg-primary lg:before:transition-opacity",
                active
                  ? "bg-secondary text-foreground font-medium lg:before:opacity-100"
                  : "text-muted-foreground lg:before:opacity-0 hover:bg-secondary/60 hover:text-foreground",
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
    </>
  );
}
