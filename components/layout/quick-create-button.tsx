"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Briefcase,
  FileText,
  ListChecks,
  Plus,
  Receipt,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";

type QuickAction = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ACTIONS: QuickAction[] = [
  { href: "/leads/new", label: "Nuevo lead", icon: User },
  { href: "/clients/new", label: "Nuevo cliente", icon: Users },
  { href: "/projects/new", label: "Nuevo proyecto", icon: Briefcase },
  { href: "/tasks/new", label: "Nueva tarea", icon: ListChecks },
  { href: "/proposals/new", label: "Nueva propuesta", icon: FileText },
  { href: "/reminders/new", label: "Nuevo recordatorio", icon: Receipt },
];

export function QuickCreateButton() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-end px-4 md:px-6">
      <div className="pointer-events-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="h-12 w-12 rounded-full p-0 shadow-lg"
              aria-label="Acciones rápidas"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="min-w-56"
          >
            <DropdownMenuLabel>Crear nuevo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACTIONS.map((action) => (
              <DropdownMenuItem key={action.href} asChild>
                <Link href={action.href} className="flex items-center gap-2">
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
