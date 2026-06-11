"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUndoableDelete } from "@/lib/hooks/use-undoable-delete";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { deleteProject, restoreProject } from "../actions";

/**
 * Kebab menu hosting destructive actions for a project. Soft-deletes via
 * `deleted_at`. The delete is frictionless (no confirm dialog) and offers a
 * "Deshacer" toast to restore it.
 */
export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const { run: onDelete, pending } = useUndoableDelete({
    successMessage: "Proyecto eliminado",
    onDelete: () => deleteProject({ id: projectId }),
    onRestore: () => restoreProject({ id: projectId }),
    redirectTo: "/projects",
  });

  return (
    <div className="flex items-center gap-2">
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
