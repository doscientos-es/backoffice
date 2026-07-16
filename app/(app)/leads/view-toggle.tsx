"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function LeadsViewToggle({ view }: { view: "board" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<"board" | "list" | null>(null);

  const navigate = (target: "board" | "list") => {
    if (target === view) return;
    setPending(target);
    startTransition(() => {
      const next = new URLSearchParams();
      for (const key of ["q", "source", "assignee", "attention"]) {
        const value = params.get(key);
        if (value) next.set(key, value);
      }
      if (target === "list") {
        const status = params.get("status");
        if (status) next.set("status", status);
        next.set("view", "list");
      }
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
      setPending(null);
    });
  };

  const activeCount = [
    "q",
    "source",
    "assignee",
    "attention",
    ...(view === "list" ? ["status"] : []),
  ].filter((key) => Boolean(params.get(key))).length;

  return (
    <div className="flex items-center gap-2">
      {activeCount > 0 ? (
        <Badge
          variant="neutral"
          className="h-5 px-1.5 text-[11px] tabular-nums"
          title={`${activeCount} filtros activos`}
        >
          {activeCount}
        </Badge>
      ) : null}
      <ButtonGroup className="border border-border rounded-lg bg-muted/30">
        <Button
          size="sm"
          variant={view === "board" ? "secondary" : "ghost"}
          className={view !== "board" ? "text-muted-foreground hover:text-foreground" : ""}
          disabled={pending !== null}
          onClick={() => navigate("board")}
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
          onClick={() => navigate("list")}
        >
          {pending === "list" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <List className="size-3.5" />
          )}
          Lista
        </Button>
      </ButtonGroup>
    </div>
  );
}
