"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteTask } from "../actions";

/**
 * Kebab menu hosting destructive actions for a task. Soft-deletes via
 * `deleted_at`, so the row disappears from the UI but stays recoverable from
 * the database. Mirrors the dropdown affordance used in projects/proposals.
 */
export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const feedback = useFormFeedback();

  const onDelete = () => {
    if (!confirm("¿Eliminar esta tarea? Podrás restaurarla desde la base de datos.")) return;
    startTransition(async () => {
      feedback.setPending();
      const res = await deleteTask({ taskId });
      if (res.ok) {
        router.push("/tasks");
        router.refresh();
      } else {
        feedback.setError(res.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <FormFeedback state={feedback.state} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} aria-label="Más acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive" disabled={pending} onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
