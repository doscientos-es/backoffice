"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";

export function LeadsViewToggle({ view }: { view: "board" | "list" }) {
  return (
    <div className="inline-flex rounded-md ring-1 ring-border bg-card p-0.5">
      <Tab href="/leads" active={view === "board"} icon={<LayoutGrid className="size-3.5" />}>
        Tablero
      </Tab>
      <Tab href="/leads?view=list" active={view === "list"} icon={<List className="size-3.5" />}>
        Lista
      </Tab>
    </div>
  );
}

function Tab({
  href,
  active,
  icon,
  children,
}: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Button
      asChild
      size="sm"
      variant={active ? "secondary" : "ghost"}
      className={cn("h-7 gap-1.5 px-2.5 text-xs", !active && "text-muted-foreground")}
    >
      <Link href={href}>
        {icon}
        {children}
      </Link>
    </Button>
  );
}
