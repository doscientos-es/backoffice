"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Params that are meaningful in both views. */
const SHARED_PARAMS = ["q", "project", "priority"] as const;
/** Params only meaningful in list view. */
const LIST_ONLY_PARAMS = ["status"] as const;

export function TasksViewToggle({ view }: { view: "board" | "list" }) {
  const params = useSearchParams();

  function buildHref(target: "board" | "list"): string {
    const next = new URLSearchParams();

    // Preserve filters that work in both views.
    for (const key of SHARED_PARAMS) {
      const v = params.get(key);
      if (v) next.set(key, v);
    }

    // Preserve list-only filters only when staying/switching to list.
    if (target === "list") {
      for (const key of LIST_ONLY_PARAMS) {
        const v = params.get(key);
        if (v) next.set(key, v);
      }
    }

    if (target === "board") next.set("view", "board");

    const qs = next.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  }

  // Count filters the user has actively set (excluding page / view).
  const activeCount = [...SHARED_PARAMS, ...LIST_ONLY_PARAMS].filter(
    (k) => !!params.get(k),
  ).length;

  return (
    <div className="flex items-center gap-2">
      {activeCount > 0 && (
        <Badge
          variant="neutral"
          className="h-5 px-1.5 tabular-nums text-[11px] font-medium"
          title={`${activeCount} filtro${activeCount !== 1 ? "s" : ""} activo${activeCount !== 1 ? "s" : ""}`}
        >
          {activeCount}
        </Badge>
      )}
      <ButtonGroup className="rounded-lg border border-border bg-muted/30">
        <Button
          asChild
          size="sm"
          variant={view === "board" ? "secondary" : "ghost"}
          className={view !== "board" ? "text-muted-foreground hover:text-foreground" : ""}
        >
          <Link href={buildHref("board")}>
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
          <Link href={buildHref("list")}>
            <List className="size-3.5" />
            Lista
          </Link>
        </Button>
      </ButtonGroup>
    </div>
  );
}
