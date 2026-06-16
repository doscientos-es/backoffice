"use client";

import { Button } from "@/components/ui/button";
import { useUndoableDelete } from "@/lib/hooks/use-undoable-delete";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteTask, restoreTask, updateTaskStatus } from "./actions";

type Props = {
  taskId: string;
  status: string;
};

export function TaskRowActions({ taskId, status }: Props) {
  const router = useRouter();
  const [markPending, startMark] = useTransition();
  const isDone = status === "done" || status === "cancelled";

  const { run: runDelete, pending: deletePending } = useUndoableDelete({
    successMessage: "Tarea eliminada",
    onDelete: () => deleteTask({ taskId }),
    onRestore: () => restoreTask({ taskId }),
  });

  function handleMarkDone(e: React.MouseEvent) {
    e.stopPropagation();
    if (isDone) return;
    startMark(async () => {
      await updateTaskStatus({ taskId, status: "done" });
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      {!isDone && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Marcar como hecha"
          title="Marcar como hecha"
          disabled={markPending || deletePending}
          onClick={handleMarkDone}
          className="text-muted-foreground hover:text-green-600 dark:hover:text-green-500"
        >
          {markPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Eliminar tarea"
        title="Eliminar tarea"
        disabled={deletePending || markPending}
        onClick={(e) => {
          e.stopPropagation();
          runDelete();
        }}
        className="text-muted-foreground hover:text-destructive"
      >
        {deletePending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
