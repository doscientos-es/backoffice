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
import { CopyIcon as Copy, DotsThree as MoreHorizontal, Trash as Trash2 } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProposal, duplicateProposal, restoreProposal } from "../actions";

/** Builds the `{ id }` FormData both delete and restore proposal actions expect. */
function idFormData(proposalId: string): FormData {
  const fd = new FormData();
  fd.append("id", proposalId);
  return fd;
}

/**
 * Groups secondary proposal operations so the header stays focused on the
 * next business action. Deletion remains reversible through the undo toast.
 */
export function ProposalMoreActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [duplicating, startTransition] = useTransition();
  const { run: onDelete, pending: deleting } = useUndoableDelete({
    successMessage: "Propuesta eliminada",
    onDelete: () => deleteProposal(idFormData(proposalId)),
    onRestore: () => restoreProposal(idFormData(proposalId)),
    redirectTo: "/proposals",
  });

  const onDuplicate = () => {
    startTransition(async () => {
      const res = await duplicateProposal({ id: proposalId });
      if (res.ok) router.push(`/proposals/${res.id}`);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={duplicating || deleting}
          aria-label="Más acciones de la propuesta"
          title="Más acciones"
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem disabled={duplicating} onSelect={onDuplicate}>
          <Copy aria-hidden />
          {duplicating ? "Duplicando…" : "Duplicar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={deleting} onSelect={onDelete}>
          <Trash2 aria-hidden />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
