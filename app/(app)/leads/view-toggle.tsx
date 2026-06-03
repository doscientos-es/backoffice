"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LeadsViewToggle({ view }: { view: "board" | "list" }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<"board" | "list" | null>(null);

  const navigate = (target: "board" | "list", href: string) => {
    if (target === view) return;
    setPending(target);
    startTransition(() => {
      router.push(href);
      setPending(null);
    });
  };

  return (
    <ButtonGroup className="border border-border rounded-lg bg-muted/30">
      <Button
        size="sm"
        variant={view === "board" ? "secondary" : "ghost"}
        className={view !== "board" ? "text-muted-foreground hover:text-foreground" : ""}
        disabled={pending !== null}
        onClick={() => navigate("board", "/leads")}
      >
        {pending === "board" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <LayoutGrid className="size-3.5" />
        )}
        Tablero
      </Button>
      <Button
        size="sm"
        variant={view === "list" ? "secondary" : "ghost"}
        className={view !== "list" ? "text-muted-foreground hover:text-foreground" : ""}
        disabled={pending !== null}
        onClick={() => navigate("list", "/leads?view=list")}
      >
        {pending === "list" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <List className="size-3.5" />
        )}
        Lista
      </Button>
    </ButtonGroup>
  );
}
