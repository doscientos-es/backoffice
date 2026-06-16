"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function ProjectTasksViewToggle({ view }: { view: "list" | "board" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const navigate = (target: "list" | "board") => {
    if (target === view) return;
    startTransition(() => {
      router.push(target === "board" ? `${pathname}?tasks_view=board` : pathname);
    });
  };

  return (
    <ButtonGroup className="rounded-lg border border-border bg-muted/30">
      <Button
        size="sm"
        variant={view === "board" ? "secondary" : "ghost"}
        className={view !== "board" ? "text-muted-foreground hover:text-foreground" : ""}
        disabled={isPending}
        onClick={() => navigate("board")}
      >
        <LayoutGrid className="size-3.5" />
        Tablero
      </Button>
      <Button
        size="sm"
        variant={view === "list" ? "secondary" : "ghost"}
        className={view !== "list" ? "text-muted-foreground hover:text-foreground" : ""}
        disabled={isPending}
        onClick={() => navigate("list")}
      >
        <List className="size-3.5" />
        Lista
      </Button>
    </ButtonGroup>
  );
}
