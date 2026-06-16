"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { sileo } from "sileo";
import { completeReminder, deleteReminder, uncompleteReminder } from "./actions";

type Props = {
  reminderId: string;
  completedAt: string | null;
};

export function ReminderRowActions({ reminderId, completedAt }: Props) {
  const router = useRouter();
  const [completePending, startComplete] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const isCompleted = !!completedAt;

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    startComplete(async () => {
      const fn = isCompleted ? uncompleteReminder : completeReminder;
      const res = await fn({ id: reminderId });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startDelete(async () => {
      const res = await deleteReminder({ id: reminderId });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      sileo.success({ title: "Aviso eliminado" });
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={isCompleted ? "Reabrir aviso" : "Completar aviso"}
        title={isCompleted ? "Reabrir aviso" : "Completar aviso"}
        disabled={completePending || deletePending}
        onClick={handleToggle}
        className={
          isCompleted
            ? "text-muted-foreground hover:text-foreground"
            : "text-muted-foreground hover:text-green-600 dark:hover:text-green-500"
        }
      >
        {completePending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : isCompleted ? (
          <RotateCcw className="size-3.5" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Eliminar aviso"
        title="Eliminar aviso"
        disabled={deletePending || completePending}
        onClick={handleDelete}
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
