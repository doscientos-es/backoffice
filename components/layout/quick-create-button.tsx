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
import { cn } from "@/lib/utils";
import { Briefcase, FileText, ListChecks, Plus, User, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type QuickAction = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  key: string;
};

const ACTIONS: QuickAction[] = [
  { href: "/leads/new", label: "Nuevo lead", icon: User, shortcut: "G L", key: "l" },
  { href: "/clients/new", label: "Nuevo cliente", icon: Users, shortcut: "G C", key: "c" },
  { href: "/projects/new", label: "Nuevo proyecto", icon: Briefcase, shortcut: "G P", key: "p" },
  { href: "/tasks/new", label: "Nueva tarea", icon: ListChecks, shortcut: "G T", key: "t" },
  { href: "/proposals/new", label: "Nueva propuesta", icon: FileText, shortcut: "G R", key: "r" },
];

export function QuickCreateButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === "g") {
        setGPressed(true);
        // Reset after 1 second if no follow-up key is pressed
        setTimeout(() => setGPressed(false), 1000);
        return;
      }

      if (gPressed) {
        const action = ACTIONS.find((a) => a.key === key);
        if (action) {
          e.preventDefault();
          router.push(action.href);
          setGPressed(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gPressed, router]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-end px-4 md:px-6">
      <div className="pointer-events-auto">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="h-12 w-12 rounded-full p-0 shadow-lg"
              aria-label="Acciones rápidas (G + tecla)"
            >
              <Plus className={cn("h-5 w-5 transition-transform", isOpen && "rotate-45")} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" sideOffset={8} className="min-w-56">
            <DropdownMenuLabel className="flex items-center justify-between">
              Crear nuevo
              <span className="text-[10px] font-normal text-muted-foreground uppercase">Atajos: G + ...</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACTIONS.map((action) => (
              <DropdownMenuItem key={action.href} asChild>
                <Link href={action.href} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </div>
                  {action.shortcut && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {action.shortcut}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
