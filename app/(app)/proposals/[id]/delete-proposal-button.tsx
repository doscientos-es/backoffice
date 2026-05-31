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
import { deleteProposal } from "../actions";

/**
 * Kebab menu hosting destructive actions for a proposal. Currently only
 * exposes a soft-delete (sets `deleted_at`) which is reversible from the DB.
 * Mirrors the dropdown affordance used in invoice-actions for consistency.
 */
export function DeleteProposalButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const feedback = useFormFeedback();

  const onDelete = () => {
    if (!confirm("¿Eliminar esta propuesta? Podrás restaurarla desde la base de datos.")) return;
    startTransition(async () => {
      feedback.setPending();
      const fd = new FormData();
      fd.append("id", proposalId);
      const res = await deleteProposal(fd);
      if (res.ok) {
        router.push("/proposals");
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
