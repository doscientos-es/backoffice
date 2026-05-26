"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";

export function LeadsViewToggle({ view }: { view: "board" | "list" }) {
  return (
    <ButtonGroup className="border border-border rounded-lg bg-muted/30">
      <Button
        asChild
        size="sm"
        variant={view === "board" ? "secondary" : "ghost"}
        className={view !== "board" ? "text-muted-foreground hover:text-foreground" : ""}
      >
        <Link href="/leads">
          <LayoutGrid className="size-3.5" />
          Tablero
        </Link>
      </Button>
      <Button
        asChild
        size="sm"
        variant={view === "list" ? "secondary" : "ghost"}
        className={view !== "list" ? "text-muted-foreground hover:text-foreground" : ""}
      >
        <Link href="/leads?view=list">
          <List className="size-3.5" />
          Lista
        </Link>
      </Button>
    </ButtonGroup>
  );
}
