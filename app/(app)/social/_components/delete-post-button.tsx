"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUndoableDelete } from "@/lib/hooks/use-undoable-delete";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { deletePost, deletePostLocal, restorePost } from "../actions";

/**
 * Overflow menu for a PostCard with two deletion modes:
 * 1. "Eliminar de todas las redes" — deletes from social networks + soft-deletes locally.
 * 2. "Eliminar del backoffice" — soft-deletes locally + removes Supabase media (networks untouched).
 */
export function DeletePostButton({ postId }: { postId: string }) {
  const { run: onDeleteAll, pending: pendingAll } = useUndoableDelete({
    successMessage: "Eliminado de todas las redes",
    onDelete: () => deletePost({ postId }),
    onRestore: () => restorePost({ postId }),
  });

  const { run: onDeleteLocal, pending: pendingLocal } = useUndoableDelete({
    successMessage: "Eliminado del backoffice",
    onDelete: () => deletePostLocal({ postId }),
    onRestore: () => restorePost({ postId }),
  });

  const pending = pendingAll || pendingLocal;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label="Más acciones"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={pending}
          onClick={onDeleteAll}
        >
          <Trash2 className="mr-2 size-4" />
          Eliminar de todas las redes
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={pending}
          onClick={onDeleteLocal}
        >
          <Trash2 className="mr-2 size-4" />
          Eliminar del backoffice
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
