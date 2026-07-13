"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { useRef, useTransition } from "react";
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from "../checklist-actions";

export type ChecklistItemRow = {
  id: string;
  label: string;
  is_done: boolean;
  position: number;
};

export function ChecklistSection({
  projectId,
  items,
  canEdit,
}: {
  projectId: string;
  items: ChecklistItemRow[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const done = items.filter((i) => i.is_done);
  const todo = items.filter((i) => !i.is_done);
  const pct = items.length === 0 ? 0 : Math.round((done.length / items.length) * 100);

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleChecklistItem({ id, is_done: !current });
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteChecklistItem({ id });
    });
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const label = inputRef.current?.value.trim();
    if (!label) return;
    startTransition(async () => {
      await addChecklistItem({ project_id: projectId, label });
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <CardTitle>Onboarding</CardTitle>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {done.length}/{items.length}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex-1 max-w-32">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct === 100 ? "bg-emerald-500" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-0 pb-4">
        {items.length === 0 && (
          <p className="px-6 py-2 text-sm text-muted-foreground">Sin elementos. Añade uno abajo.</p>
        )}

        {todo.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}

        {done.length > 0 && todo.length > 0 && <div className="mx-6 my-1 border-t border-border" />}

        {done.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}

        {canEdit && (
          <form
            onSubmit={handleAdd}
            className="flex items-center gap-2 px-6 pt-3 border-t border-border mt-2"
          >
            <Input
              ref={inputRef}
              name="label"
              placeholder="Añadir elemento…"
              className="h-8 text-sm"
              disabled={pending}
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              <Plus className="size-3.5" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ItemRow({
  item,
  canEdit,
  onToggle,
  onDelete,
}: {
  item: ChecklistItemRow;
  canEdit: boolean;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 px-6 py-1.5 hover:bg-muted/40 transition-colors">
      <button
        type="button"
        onClick={() => canEdit && onToggle(item.id, item.is_done)}
        disabled={!canEdit}
        className={cn(
          "shrink-0 transition-colors",
          item.is_done ? "text-emerald-500" : "text-muted-foreground hover:text-foreground",
          !canEdit && "cursor-default",
        )}
        aria-label={item.is_done ? "Marcar pendiente" : "Marcar hecho"}
      >
        {item.is_done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
      </button>
      <span className={cn("flex-1 text-sm", item.is_done && "line-through text-muted-foreground")}>
        {item.label}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          aria-label="Eliminar"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
