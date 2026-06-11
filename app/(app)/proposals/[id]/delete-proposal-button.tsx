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
import { deleteProposal, restoreProposal } from "../actions";

/** Builds the `{ id }` FormData both delete and restore proposal actions expect. */
function idFormData(proposalId: string): FormData {
  const fd = new FormData();
  fd.append("id", proposalId);
  return fd;
}

/**
 * Kebab menu hosting destructive actions for a proposal. Soft-deletes (sets
 * `deleted_at`) which is reversible from the DB. The delete is frictionless
 * (no confirm dialog) and offers a "Deshacer" toast to restore it.
 */
export function DeleteProposalButton({ proposalId }: { proposalId: string }) {
  const { run: onDelete, pending } = useUndoableDelete({
    successMessage: "Propuesta eliminada",
    onDelete: () => deleteProposal(idFormData(proposalId)),
    onRestore: () => restoreProposal(idFormData(proposalId)),
    redirectTo: "/proposals",
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
