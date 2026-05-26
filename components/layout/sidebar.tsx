"use client";

import { Logo } from "@/components/branding";
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

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-[color:var(--border)] bg-surface md:flex md:flex-col">
      <div className="px-4 py-5">
        <Link href="/inicio" aria-label="doscientos · Inicio">
          <Logo size="md" />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-[color:var(--surface-hover)] text-[color:var(--text-primary)] font-medium"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">
        v0.1 · MVP
      </div>
    </aside>
  );
}
