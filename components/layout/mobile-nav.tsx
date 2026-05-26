"use client";

import { Logo } from "@/components/branding";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckSquare,
  FileSignature,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  Menu,
  Receipt,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Drawer direction="left" open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            aria-label="Abrir menú"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)] transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="bg-surface w-64! max-w-[80vw]!">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-[color:var(--border)]">
              <Link href="/inicio" onClick={() => setOpen(false)} aria-label="doscientos · Inicio">
                <Logo size="md" />
              </Link>
              <DrawerClose asChild>
                <button
                  aria-label="Cerrar menú"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>

            {/* Nav links */}
            <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3 overflow-y-auto">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
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

            {/* Footer */}
            <div className="px-4 py-3 text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">
              v0.1 · MVP
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
