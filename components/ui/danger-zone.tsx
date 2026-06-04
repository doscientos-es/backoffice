"use client";

import { ChevronDown, ShieldAlert } from "lucide-react";
import type * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Collapsed-by-default container for destructive actions. Forces the user to
 * deliberately expand the section before any irreversible action is shown.
 */
export function DangerZone({
  title = "Zona de peligro",
  description = "Acciones irreversibles. Ábrela solo si estás seguro.",
  defaultOpen = false,
  className,
  children,
}: {
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <Card className={cn("border-destructive/30", className)}>
        <CollapsibleTrigger className="group/danger flex w-full items-center gap-3 px-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ShieldAlert className="size-4 shrink-0 text-destructive" />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-heading text-base font-medium leading-snug text-destructive">
              {title}
            </span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded/danger:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
